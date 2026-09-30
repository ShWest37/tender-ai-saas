"""
Универсальный адаптер площадки, добавленной администратором по API-адресу.

Работает для любых ЕТП, у которых есть публичный JSON API: конфиг хранит
api_url (+ опционально api_key), парсер делает GET и приводит ответ к формату
модели Tender. Используется реестром как fallback, если platform_name
отсутствует в PARSER_REGISTRY.
"""
import logging
from typing import Any

import httpx

from app.parsers.base import BaseParser

logger = logging.getLogger("app.parsers.generic")

# Частые ключи, под которыми API отдаёт список записей
_LIST_KEYS = ("records", "items", "results", "data", "tenders", "orders", "lots")


class GenericAPIParser(BaseParser):
    """GET api_url → JSON-список → normalize."""

    platform_name: str = "generic"
    default_law_type = "44-FZ"

    def __init__(
        self,
        api_url: str,
        platform_name: str = "generic",
        api_key: str | None = None,
        timeout: float = 20.0,
    ):
        self.api_url = api_url
        self.platform_name = platform_name
        self.api_key = api_key
        self.timeout = timeout

    async def fetch_raw(self) -> list[dict[str, Any]]:
        headers = {"Accept": "application/json", "User-Agent": "BidFlow/1.0 (+api)"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            resp = await client.get(self.api_url, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in _LIST_KEYS:
                value = data.get(key)
                if isinstance(value, list):
                    return value
            # Одна запись без списка — тоже принимаем
            return [data]
        logger.warning("API площадки %s вернул неожиданный формат: %s", self.platform_name, type(data))
        return []

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(raw, dict):
            return None
        title = raw.get("title") or raw.get("name") or raw.get("subject") or raw.get("lotName")
        raw_id = raw.get("id") or raw.get("regNum") or raw.get("purchaseCode") or raw.get("external_id")
        if not title or raw_id is None:
            return None
        return {
            "external_id": self.build_external_id(raw_id),
            "platform": self.platform_name,
            "title": str(title).strip(),
            "description": raw.get("description") or raw.get("subject"),
            "law_type": raw.get("law_type") or self.default_law_type,
            "initial_price": raw.get("initial_price") or raw.get("maxPrice") or raw.get("price"),
            "region": raw.get("region") or raw.get("regionName"),
            "customer_name": raw.get("customer_name") or raw.get("customerName") or raw.get("customer"),
            "customer_inn": raw.get("customer_inn") or raw.get("customerInn") or raw.get("inn"),
            "submission_deadline": self._parse_dt(
                raw.get("submission_deadline") or raw.get("collectDeadline") or raw.get("deadlineDate")
            ),
            "status": "active",
            "raw_data": raw,
        }
