"""
Адаптер открытых данных (zakupki.gov.ru / ЕИС, формат open data JSON).

Реальный контракт ЕИС меняется, поэтому endpoint берётся из ParserConfig.api_url
(по умолчанию — публичный экспорт position orders). Парсер устойчив к недоступности:
при ошибке возвращает пустой список, оркестратор зафиксирует это в ParserConfig.
"""
import logging
from typing import Any

import httpx

from app.parsers.base import BaseParser

logger = logging.getLogger("app.parsers.open_data")


class OpenDataParser(BaseParser):
    platform_name = "zakupki_gov"
    default_law_type = "44-FZ"

    def __init__(self, api_url: str | None = None, timeout: int = 30):
        self.api_url = api_url or "https://zakupki.gov.ru/epz/order/extendedsearch/results.html"
        self.timeout = timeout

    async def fetch_raw(self) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(self.api_url, params={"searchQuery": "", "resultsPerPage": 50})
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("OpenData fetch failed (%s): %s", self.api_url, exc)
            return []

        # Поддерживаем два частых формата ответа: {"records":[...]} и [...]
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data.get("records") or data.get("items") or data.get("data") or []
        return []

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        title = raw.get("title") or raw.get("subjectNames") or raw.get("name")
        if not title:
            return None

        raw_id = raw.get("regNum") or raw.get("id") or raw.get("purchaseCode")
        if raw_id is None:
            return None

        return {
            "external_id": self.build_external_id(raw_id),
            "platform": self.platform_name,
            "title": str(title).strip(),
            "description": raw.get("description") or raw.get("subject"),
            "law_type": raw.get("lawType") or self.default_law_type,
            "initial_price": raw.get("maxPrice") or raw.get("initialPrice") or raw.get("price"),
            "region": raw.get("region") or (raw.get("regionName") or {}),
            "customer_name": raw.get("customerName") or raw.get("customer"),
            "customer_inn": raw.get("customerInn") or raw.get("inn"),
            "submission_deadline": self._parse_dt(
                raw.get("collectDeadline") or raw.get("deadlineDate") or raw.get("closingDate")
            ),
            "status": "active",
            "raw_data": raw,
        }
