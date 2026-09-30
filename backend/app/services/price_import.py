"""
Загрузка и разбор открытых прайс-листов поставщиков (Excel/CSV/JSON/API).

Поддерживаемые источники:
- CSV/TXT  (source_type="csv") — разделитель определяется автоматически;
- Excel    (source_type="xlsx") — лист через openpyxl (импорт ленивый);
- JSON     (source_type="json" | "api") — список объектов или {"records": [...]}.

Столбцы сопоставляются по русским/английским алиасам, поэтому прайс-листы
дистрибьюторов с типовыми заголовками («Наименование», «Цена», «Артикул»)
разбираются без ручной настройки.

Если реальный прайс недоступен (нет сети / нужна авторизация), функция
не падает: в источник подставляется встроенный демо-каталог, а ошибка
сохраняется в SupplierSource.last_error и показывается администратору.
"""
from __future__ import annotations

import csv
import io
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SupplierOffer, SupplierSource
from app.services.categories import DEFAULT_CATEGORY, CATEGORY_BY_ID
from app.services.supplier_catalog import DEMO_OFFERS

logger = logging.getLogger("app.services.price_import")

MAX_ROWS = 2000

# --- Алиасы столбцов -------------------------------------------------------
COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "title": ("наименование", "название", "товар", "продукт", "позиция", "item", "name", "title"),
    "sku": ("артикул", "код товара", "код", "sku", "ид", "идентификатор", "part number"),
    "price": ("цена с ндс", "цена", "розничная цена", "стоимость", "price", "цена, руб"),
    "stock": ("наличие", "остаток", "остаток на складе", "количество", "кол-во", "stock", "qty"),
    "delivery_days": (
        "срок поставки", "срок доставки", "доставка", "срок", "дней", "delivery",
        "lead time",
    ),
    "description": ("описание", "характеристики", "description", "комментарий"),
    "unit": ("единица измерения", "ед. изм", "ед изм", "unit", "измерение"),
    "url": ("ссылка", "url", "адрес", "сайт"),
}


def _norm(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip().lower()


def parse_price(value: Any) -> Optional[float]:
    """«74 990,50 ₽» → 74990.5; мусор → None."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("₽", "").replace("руб", "").replace("\xa0", " ")
    text = re.sub(r"[^\d.,\-]", "", text).strip()
    if not text:
        return None
    # "1 234.56" уже разобран; "1.234,56" → "1234.56"
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def parse_int(value: Any) -> Optional[int]:
    number = parse_price(value)
    if number is None:
        return None
    return int(round(number))


def _match_column(header: str) -> Optional[str]:
    """Заголовок столбца → каноничное имя поля."""
    normalized = _norm(header)
    if not normalized:
        return None
    for field, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if normalized == alias or alias in normalized:
                return field
    return None


def _row_to_offer(row: dict[str, Any], mapping: dict[str, str], index: int) -> dict[str, Any]:
    """Собирает позицию из строки прайса по найденной карте столбцов."""
    offer: dict[str, Any] = {"index": index}
    for csv_key, field in mapping.items():
        offer[field] = row.get(csv_key)

    title = str(offer.get("title") or "").strip()
    if not title:
        # Без названия строка бессмысленна — пробуем взять первое непустое значение
        for value in row.values():
            if str(value or "").strip():
                title = str(value).strip()
                break
    offer["title"] = title
    offer["price"] = parse_price(offer.get("price"))
    offer["stock"] = parse_int(offer.get("stock"))
    offer["delivery_days"] = parse_int(offer.get("delivery_days"))
    offer["sku"] = str(offer.get("sku") or "").strip() or None
    offer["unit"] = str(offer.get("unit") or "шт").strip() or "шт"
    offer["description"] = str(offer.get("description") or "").strip() or None
    offer["url"] = str(offer.get("url") or "").strip() or None
    offer["specs"] = _specs_from_description(offer.get("description"))
    return offer


def _specs_from_description(description: Optional[str]) -> dict[str, str]:
    """«Процессор: i5; ОЗУ: 16 ГБ» → {"Процессор": "i5", "ОЗУ": "16 ГБ"}."""
    if not description:
        return {}
    specs: dict[str, str] = {}
    for chunk in re.split(r"[;\n]", str(description)):
        if ":" in chunk or "—" in chunk or " - " in chunk:
            parts = re.split(r":|—| - ", chunk, maxsplit=1)
            key = parts[0].strip()
            value = parts[1].strip() if len(parts) > 1 else ""
            if key and value and len(key) < 60 and len(value) < 200:
                specs[key] = value
    return specs


# --- Разбор форматов -------------------------------------------------------
def parse_csv(content: bytes) -> list[dict[str, Any]]:
    text = content.decode("utf-8-sig", errors="replace")
    if text.count(";") > text.count(",") and text.count(";") > text.count("\t"):
        delimiter = ";"
    elif text.count("\t") > text.count(","):
        delimiter = "\t"
    else:
        delimiter = ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    return [dict(row) for row in reader if any(str(v or "").strip() for v in row.values())]


def parse_json(content: bytes) -> list[dict[str, Any]]:
    data = json.loads(content.decode("utf-8-sig", errors="replace"))
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    if isinstance(data, dict):
        for key in ("records", "items", "data", "products", "offers", "results"):
            if isinstance(data.get(key), list):
                return [r for r in data[key] if isinstance(r, dict)]
    return []


def parse_xlsx(content: bytes) -> list[dict[str, Any]]:
    """Excel (.xlsx). openpyxl импортируется лениво — он необязателен в тестах."""
    try:
        from openpyxl import load_workbook  # type: ignore
    except ImportError as exc:  # pragma: no cover - зависит от окружения
        raise RuntimeError(
            "Для чтения Excel нужен пакет openpyxl (pip install openpyxl)"
        ) from exc

    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet = workbook.active
    rows = sheet.iter_rows(values_only=True)
    try:
        header = next(rows)
    except StopIteration:
        return []
    keys = [str(h) if h is not None else f"col_{i}" for i, h in enumerate(header)]
    return [
        {keys[i]: value for i, value in enumerate(row) if i < len(keys)}
        for row in rows
        if any(v is not None and str(v).strip() for v in row)
    ]


def normalize_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Сопоставляет столбцы и приводит строки к единому виду."""
    if not rows:
        return []
    header_keys = list(rows[0].keys())
    mapping: dict[str, str] = {}
    for key in header_keys:
        field = _match_column(key)
        if field and field not in mapping.values():
            mapping[key] = field
    # Если ни один заголовок не распознан, но столбцов 3-5 — считаем,
    # что порядок классический: наименование, цена, артикул...
    if "title" not in mapping.values() and 3 <= len(header_keys) <= 6:
        mapping[header_keys[0]] = "title"
        if len(header_keys) > 1:
            mapping[header_keys[1]] = "price"
        if len(header_keys) > 2:
            mapping[header_keys[2]] = "sku"

    offers = []
    for index, row in enumerate(rows[:MAX_ROWS]):
        offer = _row_to_offer(row, mapping, index)
        if offer["title"]:
            offers.append(offer)
    return offers


async def fetch_price_list(url: str, timeout: float = 30.0) -> bytes:
    """Скачивает открытый прайс-лист (CSV/Excel/JSON) по URL."""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "TenderAI/1.0 (+price-list)"})
        resp.raise_for_status()
        return resp.content


def parse_by_source_type(source_type: str, url: str, content: bytes) -> list[dict[str, Any]]:
    """Выбирает парсер по типу источника и расширению URL."""
    lowered = (url or "").lower()
    if source_type in ("csv", "txt") or lowered.endswith((".csv", ".txt")):
        rows = parse_csv(content)
    elif source_type in ("xlsx", "excel") or lowered.endswith((".xlsx", ".xls")):
        rows = parse_xlsx(content)
    elif source_type in ("json", "api") or lowered.endswith(".json"):
        rows = parse_json(content)
    else:
        # Неизвестное расширение: пробуем JSON, затем CSV
        try:
            rows = parse_json(content)
            if not rows:
                raise ValueError("not json")
        except Exception:  # noqa: BLE001
            rows = parse_csv(content)
    return normalize_rows(rows)


def demo_rows_for_category(category_id: Optional[str]) -> list[dict[str, Any]]:
    """Позиции встроенного демо-каталога: для конкретной категории или для всех."""
    categories = [category_id] if category_id and category_id in DEMO_OFFERS else list(DEMO_OFFERS)
    offers: list[dict[str, Any]] = []
    for current in categories:
        for item in DEMO_OFFERS.get(current, []):
            offers.append(
                {
                    "index": len(offers),
                    "category": current,
                    "title": item["title"],
                    "sku": item.get("sku"),
                    "price": item.get("price"),
                    "stock": item.get("stock"),
                    "delivery_days": item.get("delivery_days"),
                    "unit": "шт",
                    "description": item.get("description"),
                    "url": None,
                    "specs": item.get("specs") or {},
                }
            )
    return offers


async def _store_offers(
    db: AsyncSession,
    source: SupplierSource,
    rows: Iterable[dict[str, Any]],
    *,
    is_demo: bool,
) -> int:
    """Полная замена позиций источника (простой и предсказуемый синк)."""
    await db.execute(delete(SupplierOffer).where(SupplierOffer.source_id == source.id))
    supplier_name = source.supplier_name or source.name
    default_category = source.category or DEFAULT_CATEGORY
    stored = 0
    for row in rows:
        title = str(row.get("title") or "").strip()
        if not title:
            continue
        db.add(
            SupplierOffer(
                source_id=source.id,
                supplier_name=supplier_name,
                sku=row.get("sku"),
                title=title[:500],
                description=row.get("description"),
                specs=row.get("specs") or {},
                price=row.get("price"),
                unit=row.get("unit") or "шт",
                stock=row.get("stock"),
                delivery_days=row.get("delivery_days"),
                url=(str(row.get("url"))[:1000] if row.get("url") else None),
                category=row.get("category") or default_category,
                is_demo=is_demo,
                raw_data={"source_type": source.source_type, "index": row.get("index")},
            )
        )
        stored += 1
    source.offers_count = stored
    return stored


async def sync_source(db: AsyncSession, source: SupplierSource) -> dict[str, Any]:
    """
    Обновляет позиции источника.

    Сценарии:
    - "remote" — прайс скачан и разобран;
    - "demo"   — источник демо-каталог или реальный прайс недоступен,
                 в источник положен встроенный каталог (с ошибкой в last_error).
    """
    result: dict[str, Any] = {"source_id": source.id, "slug": source.slug, "mode": "demo", "imported": 0, "error": None}
    url = source.api_url if source.source_type == "api" else source.price_list_url

    if source.source_type != "demo" and url:
        try:
            content = await fetch_price_list(url)
            rows = parse_by_source_type(source.source_type, url, content)
            if not rows:
                raise ValueError("в прайсе не найдено ни одной позиции")
            imported = await _store_offers(db, source, rows, is_demo=False)
            source.last_error = None
            source.last_sync_at = datetime.now(timezone.utc)
            result.update(mode="remote", imported=imported, error=None)
            await db.flush()
            return result
        except Exception as exc:  # noqa: BLE001 — источник не должен ронять поиск
            logger.warning("price list sync failed for %s: %s", source.slug, exc)
            result["error"] = str(exc)

    # Демо-режим: встроенный каталог (для категории источника или для всех категорий)
    rows = demo_rows_for_category(source.category)
    imported = await _store_offers(db, source, rows, is_demo=True)
    source.last_error = result["error"] or (
        "Источник настроен как демо-каталог" if source.source_type == "demo" else None
    )
    source.last_sync_at = datetime.now(timezone.utc)
    result.update(mode="demo", imported=imported)
    await db.flush()
    return result


async def seed_preset_offers(db: AsyncSession, source: SupplierSource) -> dict[str, Any]:
    """Быстрое наполнение пресета демо-данными (кнопка «Заполнить демо»)."""
    source.source_type = "demo"
    result = await sync_source(db, source)
    return result


def category_options() -> list[dict[str, str]]:
    """Список категорий для админ-форм (id + название)."""
    return [{"id": nid, "label": category["label"]} for nid, category in CATEGORY_BY_ID.items()]
