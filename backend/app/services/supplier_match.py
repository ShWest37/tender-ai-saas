"""
AI-сравнение ТЗ тендера с предложением поставщика.

Пайплайн:
1) extract_tz          — разбирает ТЗ тендера (JSON) из описания и raw_data;
2) prefilter            — дешёвая детерминированная фильтрация прайса
                          (цена, сроки, релевантность категории);
3) compare_offer        — отправляет пару «ТЗ + строка прайса» в YandexGPT
                          с промптом «Сравни требования ТЗ и предложение
                          поставщика. Верни JSON с полями: match_percentage,
                          matched_specs, mismatched_specs, warnings»;
4) при недоступности LLM возвращается детерминированный расчёт —
                          функция не должна «падать» ни при каких условиях.

Красные флаги (цена выше НМЦК, сроки поставки длиннее срока подачи,
характеристики, которых нет в предложении) добавляются в warnings всегда.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from app.db.models import SupplierOffer, Tender

logger = logging.getLogger("app.services.supplier_match")

SYSTEM_PROMPT = (
    "Ты — эксперт по тендерным закупкам и снабжению. "
    "Ты сравниваешь техническое задание (ТЗ) тендера с предложением поставщика "
    "из прайс-листа и выдаёшь строгий JSON без пояснений."
)

USER_PROMPT_TEMPLATE = """Сравни требования ТЗ и предложение поставщика.
Верни JSON с полями: match_percentage, matched_specs, mismatched_specs, warnings

Правила:
- match_percentage — число от 0 до 100 (процент соответствия ТЗ);
- matched_specs — массив строк: требования ТЗ, которые предложение выполняет;
- mismatched_specs — массив строк: требования ТЗ, которые предложение НЕ выполняет;
- warnings — массив строк: риски и «красные флаги» (цена, сроки, наличие, гарантия);
- отвечай ТОЛЬКО валидным JSON без markdown-обёрток и пояснений.

ТЗ (JSON):
{tz}

Предложение поставщика (JSON):
{offer}
"""


# ---------------------------------------------------------------------------
# 1. Разбор ТЗ
# ---------------------------------------------------------------------------
_SPEC_LINE = re.compile(r"^\s*(?P<key>[^:：]{2,60}?)\s*[:：]\s*(?P<value>.{1,200})\s*$")
_DASH_LINE = re.compile(r"^\s*(?P<key>[^-\–—]{2,50}?)\s*[-–—]\s*(?P<value>.{1,200})\s*$")
_QTY_RES = (
    # «Количество: 20», «Объём — 10»
    re.compile(r"(?:количество|объ[её]м|кол-во)\s*[:\-]?\s*(\d[\d\s]{0,6})", re.I),
    # «20 шт.», «20 единиц»
    re.compile(r"\b(\d{1,4})\s*(?:штук|шт\.?|единиц|ед\.?)\b", re.I),
    # «Поставка 20 ноутбуков», «заказ 5 серверов»
    re.compile(r"\b(?:поставк\w*|заказ\w*|приобретен\w*)\s+(\d{1,4})\b", re.I),
)


def _clean_text(text: Optional[str], limit: int = 1500) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()[:limit]


def _extract_specs_from_text(text: str) -> dict[str, str]:
    specs: dict[str, str] = {}
    for line in str(text or "").splitlines():
        line = line.strip(" •\t")
        if not line or len(line) > 220:
            continue
        match = _SPEC_LINE.match(line) or _DASH_LINE.match(line)
        if not match:
            continue
        key = match.group("key").strip(" -")
        value = match.group("value").strip()
        if not key or not value or len(key) < 3:
            continue
        # Служебные строки, которые не являются характеристикой
        if key.lower() in ("http", "https", "требуется", "примечание"):
            continue
        specs[key] = value
    return specs


def _extract_specs_from_raw(raw_data: Any) -> dict[str, str]:
    specs: dict[str, str] = {}
    if not isinstance(raw_data, dict):
        return specs
    for key in ("specs", "requirements", "characteristics", "technical_specs", "features"):
        block = raw_data.get(key)
        if isinstance(block, dict):
            for k, v in block.items():
                if v is None:
                    continue
                specs[str(k)] = str(v)
        elif isinstance(block, list):
            for item in block:
                if isinstance(item, dict):
                    name = item.get("name") or item.get("title") or item.get("key")
                    value = item.get("value") or item.get("description")
                    if name and value:
                        specs[str(name)] = str(value)
                elif item:
                    text = str(item)
                    specs.update(_extract_specs_from_text(text))
    return specs


def extract_tz(tender: Tender) -> dict[str, Any]:
    """
    Собирает машиночитаемое ТЗ тендера (JSON) из данных парсера.
    """
    description = tender.description or ""
    title = tender.title or ""

    specs = _extract_specs_from_raw(tender.raw_data)
    specs.update(_extract_specs_from_text(description))
    # Дубли из заголовка: «Поставка ноутбуков, 20 шт., Intel i5»
    specs.update(_extract_specs_from_text(title))

    quantity = None
    for pattern in _QTY_RES:
        qty_match = pattern.search(description) or pattern.search(title)
        if qty_match:
            quantity = int(re.sub(r"\D", "", qty_match.group(1)))
            break

    deadline = None
    days_left = None
    if tender.submission_deadline is not None:
        deadline_dt = tender.submission_deadline
        if deadline_dt.tzinfo is None:
            deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
        deadline = deadline_dt.isoformat()
        days_left = max((deadline_dt - datetime.now(timezone.utc)).days, 0)

    tz: dict[str, Any] = {
        "tender_id": tender.id,
        "title": _clean_text(title, 300),
        "description": _clean_text(description, 1200),
        "customer": _clean_text(tender.customer_name, 200),
        "region": _clean_text(tender.region, 120),
        "law_type": tender.law_type,
        "budget": tender.initial_price,
        "quantity": quantity,
        "deadline": deadline,
        "days_left_before_deadline": days_left,
        "specs": specs,
    }
    return tz


# ---------------------------------------------------------------------------
# 2. Детерминированная проверка (работает без LLM)
# ---------------------------------------------------------------------------
def _norm(value: Any) -> str:
    return re.sub(r"[^a-zа-я0-9]", "", str(value or "").lower())


def offer_to_row(offer: SupplierOffer) -> dict[str, Any]:
    """Строка прайса поставщика в виде JSON для промпта и для фронта."""
    return {
        "supplier": offer.supplier_name,
        "sku": offer.sku,
        "title": offer.title,
        "description": offer.description,
        "specs": offer.specs or {},
        "price": offer.price,
        "currency": "RUB",
        "unit": offer.unit,
        "stock": offer.stock,
        "delivery_days": offer.delivery_days,
        "url": offer.url,
    }


def _haystack(offer_row: dict[str, Any]) -> str:
    parts = [
        str(offer_row.get("title") or ""),
        str(offer_row.get("description") or ""),
        str(offer_row.get("sku") or ""),
    ]
    specs = offer_row.get("specs") or {}
    if isinstance(specs, dict):
        parts.extend(f"{k} {v}" for k, v in specs.items())
    return _norm(" ".join(parts))


def heuristic_match(tz: dict[str, Any], offer_row: dict[str, Any]) -> dict[str, Any]:
    """
    Сопоставление без LLM: характеристики + красные флаги по цене и срокам.
    """
    matched: list[str] = []
    mismatched: list[str] = []
    warnings: list[str] = []

    haystack = _haystack(offer_row)
    specs = tz.get("specs") or {}

    for key, value in specs.items():
        key_n, value_n = _norm(key), _norm(value)
        label = f"{key}: {value}"
        key_found = bool(key_n) and key_n in haystack
        value_found = bool(value_n) and value_n in haystack

        if key_found and value_found:
            matched.append(label)
        elif key_found and not value_n:
            matched.append(label)
        elif key_found:
            # Характеристика упомянута, но значение не совпало
            offer_value = _offer_spec_value(offer_row, key)
            mismatched.append(
                f"{label} — в предложении: {offer_value or 'не указано'}"
            )
        else:
            warnings.append(f"Требование не подтверждено предложением: {label}")

    # --- Цена -------------------------------------------------------------
    price = offer_row.get("price")
    budget = tz.get("budget")
    if price is None:
        warnings.append("У позиции не указана цена — нельзя проверить бюджет")
    elif budget:
        if float(price) <= float(budget):
            matched.append(f"Цена {price:,.0f} ₽ укладывается в НМЦК {budget:,.0f} ₽".replace(",", " "))
        else:
            mismatched.append(
                f"Цена {price:,.0f} ₽ превышает НМЦК {budget:,.0f} ₽".replace(",", " ")
            )

    # --- Сроки -------------------------------------------------------------
    delivery = offer_row.get("delivery_days")
    days_left = tz.get("days_left_before_deadline")
    if delivery is None:
        warnings.append("Срок поставки не указан в прайсе — уточните у поставщика")
    elif days_left is None:
        warnings.append("У тендера не задан срок подачи — нельзя проверить сроки")
    elif int(delivery) <= int(days_left):
        matched.append(f"Срок поставки {delivery} дн. укладывается в {days_left} дн. до подачи")
    else:
        mismatched.append(
            f"Срок поставки {delivery} дн. не укладывается в {days_left} дн. до подачи"
        )

    # --- Наличие -----------------------------------------------------------
    stock = offer_row.get("stock")
    if stock is not None and int(stock) <= 0:
        warnings.append("Позиция отсутствует на складе поставщика")

    # --- Релевантность -----------------------------------------------------
    if not specs:
        warnings.append("В ТЗ не найдено технических характеристик — сравнение упрощено")

    total = len(matched) + len(mismatched)
    percentage = round(100.0 * len(matched) / total, 1) if total else 50.0
    if warnings and percentage > 80:
        percentage = round(percentage - 5.0, 1)

    return {
        "match_percentage": max(0.0, min(100.0, percentage)),
        "matched_specs": matched,
        "mismatched_specs": mismatched,
        "warnings": warnings,
        "engine": "deterministic",
    }


def _offer_spec_value(offer_row: dict[str, Any], key: str) -> Optional[str]:
    specs = offer_row.get("specs") or {}
    if not isinstance(specs, dict):
        return None
    key_n = _norm(key)
    for k, v in specs.items():
        if _norm(k) == key_n:
            return str(v)
    return None


# ---------------------------------------------------------------------------
# 3. Сравнение через YandexGPT
# ---------------------------------------------------------------------------
def _extract_json(text: str) -> Optional[dict[str, Any]]:
    """Достаёт JSON из ответа LLM (в т.ч. из markdown-обёртки)."""
    if not text:
        return None
    cleaned = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    try:
        data = json.loads(cleaned)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            data = json.loads(cleaned[start : end + 1])
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, (list, tuple)):
        items = []
        for item in value:
            if isinstance(item, str):
                if item.strip():
                    items.append(item.strip())
            elif isinstance(item, dict):
                text = item.get("name") or item.get("spec") or item.get("text") or item.get("message")
                if text:
                    items.append(str(text).strip())
            elif item is not None:
                items.append(str(item))
        return items
    return [str(value)]


def _normalize_match(data: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    """Приводит ответ LLM к контракту и подмешивает детерминированные красные флаги."""
    raw_pct = data.get("match_percentage", fallback["match_percentage"])
    if isinstance(raw_pct, str):
        digits = re.sub(r"[^\d.,]", "", raw_pct).replace(",", ".")
        try:
            raw_pct = float(digits)
        except ValueError:
            raw_pct = fallback["match_percentage"]
    try:
        percentage = max(0.0, min(100.0, float(raw_pct)))
    except (TypeError, ValueError):
        percentage = float(fallback["match_percentage"])

    matched = _as_str_list(data.get("matched_specs"))
    mismatched = _as_str_list(data.get("mismatched_specs"))
    warnings = _as_str_list(data.get("warnings"))

    # Красные флаги детерминированного этапа не выбрасываем: цена и сроки
    # должны быть видны тендерному специалисту в любом случае.
    for item in fallback["mismatched_specs"]:
        if not any(_norm(item) in _norm(m) or _norm(m) in _norm(item) for m in mismatched):
            mismatched.append(item)
    for item in fallback["warnings"]:
        if not any(_norm(item) in _norm(w) or _norm(w) in _norm(item) for w in warnings):
            warnings.append(item)

    return {
        "match_percentage": round(percentage, 1),
        "matched_specs": matched,
        "mismatched_specs": mismatched,
        "warnings": warnings,
        "engine": "yandex_gpt",
    }


async def compare_offer(
    tz: dict[str, Any],
    offer_row: dict[str, Any],
    *,
    use_llm: bool = True,
) -> dict[str, Any]:
    """
    Сравнение ТЗ и строки прайса. Всегда возвращает контракт
    match_percentage / matched_specs / mismatched_specs / warnings.
    """
    deterministic = heuristic_match(tz, offer_row)

    if not use_llm:
        return deterministic

    try:
        from app.ai.llm_router import LLMRouter
        from app.core.config import get_settings

        if not get_settings().YANDEX_GPT_API_KEY:
            # Ключ не настроен — работаем детерминированно, но честно предупреждаем
            result = dict(deterministic)
            result["warnings"] = result["warnings"] + [
                "ИИ-сравнение не настроено: добавьте YANDEX_GPT_API_KEY, "
                "показан детерминированный расчёт"
            ]
            return result

        user_prompt = USER_PROMPT_TEMPLATE.format(
            tz=json.dumps(tz, ensure_ascii=False),
            offer=json.dumps(offer_row, ensure_ascii=False),
        )
        raw = await LLMRouter().chat(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ]
        )
        parsed = _extract_json(raw)
        if parsed is None:
            logger.warning("LLM вернул не-JSON, используем детерминированный расчёт")
            result = dict(deterministic)
            result["warnings"] = result["warnings"] + [
                "ИИ-сравнение: ответ модели не распознан, показан детерминированный расчёт"
            ]
            return result
        return _normalize_match(parsed, deterministic)
    except Exception as exc:  # noqa: BLE001 — LLM не должен ломать функцию
        logger.warning("LLM comparison unavailable: %s", exc)
        result = dict(deterministic)
        result["warnings"] = result["warnings"] + [
            f"ИИ-сравнение временно недоступно ({exc}), показан детерминированный расчёт"
        ]
        return result


# ---------------------------------------------------------------------------
# 4. Отбор кандидатов из прайса
# ---------------------------------------------------------------------------
def relevant_offers(
    offers: list[SupplierOffer],
    tz: dict[str, Any],
    category_keywords: list[str],
    *,
    limit: int = 12,
) -> list[SupplierOffer]:
    """
    Дешёвый предфильтр: релевантность категории/заголовку, затем цена и сроки.
    Возвращает кандидатов для дорого LLM-сравнения.
    """
    title_norm = _norm(tz.get("title")) + " " + _norm(tz.get("description"))[:400]
    spec_keys = " ".join(_norm(k) for k in (tz.get("specs") or {}))
    needle = f"{title_norm} {spec_keys}".strip()

    scored: list[tuple[float, SupplierOffer]] = []
    for offer in offers:
        haystack = _haystack(offer_to_row(offer))
        if not haystack:
            continue
        score = 0.0
        # Совпадение по ключевым словам категории
        for keyword in category_keywords or []:
            if _norm(keyword) and _norm(keyword) in haystack:
                score += 2.0
        # Совпадение по словам из заголовка тендера
        words = [w for w in re.split(r"\W+", str(tz.get("title") or "").lower()) if len(w) > 4]
        for word in words:
            if _norm(word) and _norm(word) in haystack:
                score += 1.5
        # Общие токены ТЗ
        for token in needle.split():
            if len(token) > 4 and token in haystack:
                score += 0.3
        if score <= 0:
            continue

        # Ценовой фильтр: позиции дороже НМЦК штучно — красный флаг, но не выбрасываем
        if tz.get("budget") and offer.price:
            if float(offer.price) > float(tz["budget"]):
                score *= 0.6

        scored.append((score, offer))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [offer for _, offer in scored[:limit]]
