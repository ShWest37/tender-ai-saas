"""
Детерминированные (не-LLM) проверки тендерной заявки.

Идея: всё, что можно проверить кодом — проверяем кодом (Regex, арифметика,
контрольные суммы). LLM подключается только там, где нужен смысловой анализ.
Это главный барьер против галлюцинаций: детерминированные проверки не зависят
от модели и всегда дают воспроизводимый результат.

Модуль не обращается к БД и к сети — чистые функции над данными модели Tender
и сгенерированным содержимым заявки (dict). Благодаря этому он легко тестируется.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

# Маркер, который модель обязана вернуть, если ответа нет в документации.
NOT_FOUND_MESSAGE = "Требование не найдено в документации, проверьте вручную"

# Разрешённые форматы вложений тендерной заявки (по умолчанию).
ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".rtf", ".txt", ".sig"}

# Веса влияния на итоговую уверенность (штраф за непройденную проверку).
_SEVERITY_PENALTY = {"critical": 0.4, "major": 0.15, "minor": 0.05}


# --------------------------------------------------------------------------- #
# Базовые валидаторы реквизитов
# --------------------------------------------------------------------------- #
def validate_inn(inn: Optional[str]) -> bool:
    """
    Проверяет ИНН юридического лица (10 цифр) или ИП/физлица (12 цифр)
    по алгоритму контрольной суммы ФНС.
    """
    if not inn:
        return False
    inn = str(inn).strip()
    if not inn.isdigit() or len(inn) not in (10, 12):
        return False

    digits = [int(c) for c in inn]
    if len(inn) == 10:
        weights = [2, 4, 10, 3, 5, 9, 4, 6, 8]
        checksum = sum(w * d for w, d in zip(weights, digits)) % 11 % 10
        return checksum == digits[9]

    weights_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
    weights_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
    check_11 = sum(w * d for w, d in zip(weights_11, digits)) % 11 % 10
    check_12 = sum(w * d for w, d in zip(weights_12, digits)) % 11 % 10
    return check_11 == digits[10] and check_12 == digits[11]


def validate_ogrn(ogrn: Optional[str]) -> bool:
    """Проверяет ОГРН (13 цифр) по контрольному разряду."""
    if not ogrn:
        return False
    ogrn = str(ogrn).strip()
    if not ogrn.isdigit() or len(ogrn) != 13:
        return False
    control = int(ogrn[:12]) % 11 % 10
    return control == int(ogrn[12])


_OKPD2_RE = re.compile(r"^\d{2}\.\d{1,3}(\.\d{1,3}){0,2}$")


def validate_okpd2(code: Optional[str]) -> bool:
    """
    Проверяет формат кода ОКПД2: XX.X, XX.XX, XX.XX.X, XX.XX.XX, XX.XX.XX.XXX.
    Не проверяет существование кода в классификаторе — только структуру.
    """
    if not code:
        return False
    return bool(_OKPD2_RE.match(str(code).strip()))


# --------------------------------------------------------------------------- #
# Вспомогательные извлекатели
# --------------------------------------------------------------------------- #
def _as_float(value: Any) -> Optional[float]:
    """Приводит значение к float; поддерживает «1 234,56 ₽» и подобные строки."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("\u00a0", " ").replace(" ", "").replace(",", ".")
    text = re.sub(r"[^\d.\-]", "", text)
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _as_datetime(value: Any) -> Optional[datetime]:
    """Парсит дату/строку в aware-datetime (UTC)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _normalize_text(text: str) -> str:
    """Нижний регистр, схлопывание пробелов, удаление лишней пунктуации."""
    text = (text or "").lower().replace("ё", "е")
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


_NEGATION_MARKERS = ("не ", "нельзя", "запрещ", "без ", "недопуст", "отсутств", "не менее", "не более")
_STOPWORDS = {
    "который", "которая", "которые", "также", "либо", "если", "чтобы", "после", "перед",
    "между", "согласно", "требуется", "требование", "должен", "должна", "должны", "быть",
    "менее", "более", "допускается", "наличие", "отсутствие", "заказчик", "участник",
    "поставщик", "товар", "работа", "услуга", "срок", "года", "месяц", "день",
}


def _significant_words(text: str) -> set[str]:
    """Значимые слова длиной >= 5 букв без стоп-слов — для оценки пересечения."""
    words = _normalize_text(text).split()
    return {w for w in words if len(w) >= 5 and w not in _STOPWORDS}


def find_negation_sentences(source_text: str) -> list[str]:
    """Возвращает предложения исходного текста, содержащие отрицания/запреты."""
    if not source_text:
        return []
    sentences = re.split(r"(?<=[.!?;])\s+", source_text)
    result = []
    for sentence in sentences:
        low = sentence.lower().replace("ё", "е")
        if any(marker in low for marker in _NEGATION_MARKERS):
            clean = sentence.strip()
            if 5 <= len(clean) <= 400:
                result.append(clean)
    return result


def verify_evidence_quotes(
    quotes: Iterable[str],
    source_text: str,
    min_len: int = 12,
) -> list[str]:
    """
    Проверяет, что каждая цитата LLM реально присутствует в исходном контексте.

    Это ключевой анти-галлюцинационный барьер: модель обязана подтверждать
    замечания дословной цитатой из документации. Если цитаты нет в тексте —
    замечание считается выдуманным.
    """
    normalized_source = _normalize_text(source_text)
    hallucinations: list[str] = []
    for quote in quotes or []:
        if not quote or not isinstance(quote, str):
            continue
        normalized_quote = _normalize_text(quote)
        if len(normalized_quote) < min_len:
            hallucinations.append(quote.strip())
            continue
        if normalized_quote not in normalized_source:
            hallucinations.append(quote.strip())
    return hallucinations


# --------------------------------------------------------------------------- #
# Отдельные проверки
# --------------------------------------------------------------------------- #
def _check(
    code: str,
    name: str,
    status: str,
    severity: str,
    message: str,
    details: Optional[dict] = None,
) -> dict:
    """Единый формат результата одной проверки."""
    return {
        "code": code,
        "name": name,
        "status": status,  # pass | fail | warn | skipped
        "severity": severity,  # critical | major | minor
        "message": message,
        "details": details or {},
    }


def _collect_content(payload: Optional[dict]) -> dict:
    return payload if isinstance(payload, dict) else {}


def run_deterministic_checks(
    tender: Any,
    content: Optional[dict],
    *,
    source_text: str = "",
    company_inn: Optional[str] = None,
    is_final: bool = False,
) -> dict:
    """
    Прогоняет полный набор детерминированных проверок заявки.

    :param tender: ORM-объект Tender (или любой объект с теми же атрибутами).
    :param content: сгенерированное/финальное содержимое заявки (dict).
    :param source_text: текст документации/контекста (для проверки отрицаний и цитат).
    :param company_inn: ИНН участника (из профиля пользователя).
    :param is_final: True — проверяем финальную версию (требуем подпись).
    :return: отчёт со списком проверок, счётчиками и итоговой уверенностью.
    """
    data = _collect_content(content)
    checks: list[dict] = []

    # 1. Содержимое заявки заполнено ----------------------------------------
    if data:
        checks.append(_check("content_present", "Содержимое заявки заполнено", "pass", "critical",
                             "Данные заявки сформированы."))
    else:
        checks.append(_check("content_present", "Содержимое заявки заполнено", "fail", "critical",
                             "Заявка пуста: AI не сформировал ни одного поля."))

    # 2. Цена предложения ----------------------------------------------------
    offer_price = _as_float(data.get("offer_price") or data.get("price"))
    initial_price = _as_float(getattr(tender, "initial_price", None))

    if offer_price is None:
        checks.append(_check("offer_price_present", "Цена предложения указана", "fail", "critical",
                             "Цена предложения отсутствует или не является числом."))
    else:
        checks.append(_check("offer_price_present", "Цена предложения указана", "pass", "critical",
                             f"Цена предложения: {offer_price:,.2f} ₽.".replace(",", " "),
                             {"offer_price": offer_price}))

        if offer_price <= 0:
            checks.append(_check("offer_price_positive", "Цена предложения положительна", "fail",
                                 "critical", "Цена предложения должна быть больше нуля.",
                                 {"offer_price": offer_price}))
        else:
            checks.append(_check("offer_price_positive", "Цена предложения положительна", "pass",
                                 "critical", "Цена предложения положительна."))

        if initial_price is not None:
            if offer_price > initial_price:
                checks.append(_check(
                    "offer_price_within_initial",
                    "Цена не превышает НМЦК",
                    "fail",
                    "critical",
                    f"Цена предложения {offer_price:,.2f} ₽ превышает НМЦК {initial_price:,.2f} ₽ — "
                    "заявка будет отклонена.".replace(",", " "),
                    {"offer_price": offer_price, "initial_price": initial_price},
                ))
            else:
                ratio = offer_price / initial_price if initial_price else 0
                message = f"Цена {offer_price:,.2f} ₽ в пределах НМЦК {initial_price:,.2f} ₽.".replace(",", " ")
                if ratio < 0.5:
                    checks.append(_check("offer_price_within_initial", "Цена не превышает НМЦК",
                                         "warn", "major",
                                         message + " Внимание: снижение более чем на 50% требует "
                                         "обоснования (риск демпинга).",
                                         {"offer_price": offer_price, "initial_price": initial_price}))
                else:
                    checks.append(_check("offer_price_within_initial", "Цена не превышает НМЦК",
                                         "pass", "critical", message,
                                         {"offer_price": offer_price, "initial_price": initial_price}))
        else:
            checks.append(_check("offer_price_within_initial", "Цена не превышает НМЦК", "skipped",
                                 "major", "НМЦК в карточке тендера не указана — проверьте вручную."))

    # 3. Обязательные текстовые поля ----------------------------------------
    required_text_fields = {
        "delivery_terms": ("Сроки поставки указаны", "major"),
        "qualification": ("Квалификация участника описана", "major"),
        "warranty": ("Гарантийные обязательства указаны", "minor"),
    }
    for field, (title, severity) in required_text_fields.items():
        value = data.get(field)
        if isinstance(value, str) and value.strip():
            checks.append(_check(f"{field}_present", title, "pass", severity, f"{title}."))
        else:
            checks.append(_check(f"{field}_present", title, "fail" if severity != "minor" else "warn",
                                 severity, f"Поле «{field}» не заполнено."))

    # 4. ИНН участника -------------------------------------------------------
    if company_inn:
        if validate_inn(company_inn):
            checks.append(_check("company_inn_valid", "ИНН участника корректен", "pass", "critical",
                                 "Контрольная сумма ИНН верна.", {"inn": company_inn}))
        else:
            checks.append(_check("company_inn_valid", "ИНН участника корректен", "fail", "critical",
                                 "ИНН участника не проходит проверку контрольной суммы.",
                                 {"inn": company_inn}))
    else:
        checks.append(_check("company_inn_valid", "ИНН участника корректен", "warn", "critical",
                             "ИНН участника не заполнен в профиле — заполните вручную."))

    # 5. ИНН заказчика -------------------------------------------------------
    customer_inn = getattr(tender, "customer_inn", None)
    if customer_inn:
        status = "pass" if validate_inn(customer_inn) else "warn"
        message = ("ИНН заказчика корректен." if status == "pass"
                   else "ИНН заказчика не проходит проверку контрольной суммы — уточните у заказчика.")
        checks.append(_check("customer_inn_valid", "ИНН заказчика корректен", status, "major",
                             message, {"inn": customer_inn}))
    else:
        checks.append(_check("customer_inn_valid", "ИНН заказчика корректен", "skipped", "minor",
                             "ИНН заказчика не указан в карточке тендера."))

    # 6. ОКПД2 ---------------------------------------------------------------
    okpd2_codes = getattr(tender, "okpd2_codes", None) or []
    if isinstance(okpd2_codes, str):
        okpd2_codes = [okpd2_codes]
    if okpd2_codes:
        invalid = [c for c in okpd2_codes if not validate_okpd2(c)]
        if invalid:
            checks.append(_check("okpd2_format_valid", "Формат кодов ОКПД2 корректен", "warn", "major",
                                 "Коды с некорректным форматом: " + ", ".join(map(str, invalid)),
                                 {"invalid": invalid}))
        else:
            checks.append(_check("okpd2_format_valid", "Формат кодов ОКПД2 корректен", "pass", "major",
                                 f"Проверено кодов ОКПД2: {len(okpd2_codes)}."))
    else:
        checks.append(_check("okpd2_format_valid", "Формат кодов ОКПД2 корректен", "skipped", "minor",
                             "Коды ОКПД2 не указаны в карточке тендера."))

    # 7. Срок подачи ---------------------------------------------------------
    deadline = _as_datetime(getattr(tender, "submission_deadline", None))
    if deadline:
        now = datetime.now(timezone.utc)
        if deadline <= now:
            checks.append(_check("submission_deadline_future", "Срок подачи не истёк", "fail", "critical",
                                 f"Срок подачи истёк {deadline:%d.%m.%Y %H:%M} UTC — подача невозможна.",
                                 {"submission_deadline": deadline.isoformat()}))
        else:
            checks.append(_check("submission_deadline_future", "Срок подачи не истёк", "pass", "critical",
                                 f"Срок подачи: {deadline:%d.%m.%Y %H:%M} UTC.",
                                 {"submission_deadline": deadline.isoformat()}))
    else:
        checks.append(_check("submission_deadline_future", "Срок подачи не истёк", "warn", "critical",
                             "Срок подачи не указан в карточке — уточните вручную."))

    # 8. Подпись (ЭЦП) -------------------------------------------------------
    signed = data.get("is_signed") or data.get("signed") or data.get("signature")
    if signed:
        checks.append(_check("signature_present", "Подпись ЭЦП присутствует", "pass", "major",
                             "Признак подписи ЭЦП установлен."))
    else:
        checks.append(_check(
            "signature_present",
            "Подпись ЭЦП присутствует",
            "fail" if is_final else "warn",
            "major",
            "Заявка не подписана ЭЦП." if is_final else "Заявка ещё не подписана — подпись потребуется перед отправкой.",
        ))

    # 9. Форматы вложений ----------------------------------------------------
    attachments = data.get("attachments") or data.get("files") or []
    if isinstance(attachments, str):
        attachments = [attachments]
    if attachments:
        bad = []
        for name in attachments:
            ext = ("." + str(name).rsplit(".", 1)[-1].lower()) if "." in str(name) else ""
            if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
                bad.append(str(name))
        if bad:
            checks.append(_check("attachments_format_valid", "Форматы вложений допустимы", "warn", "major",
                                 "Недопустимые форматы вложений: " + ", ".join(bad), {"invalid": bad}))
        else:
            checks.append(_check("attachments_format_valid", "Форматы вложений допустимы", "pass", "major",
                                 f"Проверено вложений: {len(attachments)}."))
    else:
        checks.append(_check("attachments_format_valid", "Форматы вложений допустимы", "skipped", "minor",
                             "Вложения не указаны."))

    # 10. Отрицания из документации -----------------------------------------
    negation_sentences = find_negation_sentences(source_text)
    if negation_sentences:
        content_words = _significant_words(" ".join(str(v) for v in data.values()))
        unaddressed = []
        for sentence in negation_sentences:
            requirement_words = _significant_words(sentence)
            if requirement_words and not (requirement_words & content_words):
                unaddressed.append(sentence)
        if unaddressed:
            checks.append(_check(
                "negations_addressed",
                "Требования с отрицанием учтены",
                "warn",
                "major",
                f"Найдено {len(unaddressed)} требований с отрицанием/запретом, не отражённых в заявке. "
                "Проверьте вручную.",
                {"unaddressed": unaddressed[:5]},
            ))
        else:
            checks.append(_check("negations_addressed", "Требования с отрицанием учтены", "pass", "major",
                                 f"Проверено требований с отрицанием: {len(negation_sentences)}."))
    else:
        checks.append(_check("negations_addressed", "Требования с отрицанием учтены", "skipped", "minor",
                             "Отрицаний/запретов в документации не найдено."))

    # 11. Закон закупки ------------------------------------------------------
    law_type = getattr(tender, "law_type", None)
    if law_type and str(law_type).upper() in {"44-FZ", "223-FZ", "44FZ", "223FZ"}:
        checks.append(_check("law_type_known", "Закон закупки определён", "pass", "minor",
                             f"Тип закупки: {law_type}."))
    else:
        checks.append(_check("law_type_known", "Закон закупки определён", "warn", "minor",
                             "Тип закупки (44-ФЗ/223-ФЗ) не определён — уточните порядок подачи."))

    # Итоги ----------------------------------------------------------------
    failed = [c for c in checks if c["status"] == "fail"]
    warnings = [c for c in checks if c["status"] == "warn"]
    critical_failed = [c for c in failed if c["severity"] == "critical"]

    confidence = 1.0
    for check in checks:
        if check["status"] in ("fail", "warn"):
            confidence -= _SEVERITY_PENALTY.get(check["severity"], 0.05)
    confidence = max(0.0, round(confidence, 4))

    return {
        "checks": checks,
        "failed": failed,
        "warnings": warnings,
        "passed_count": len([c for c in checks if c["status"] == "pass"]),
        "failed_count": len(failed),
        "warnings_count": len(warnings),
        "critical_failed_count": len(critical_failed),
        "is_blocking": bool(critical_failed),
        "confidence": confidence,
        "requires_manual_review": bool(failed or warnings),
    }
