"""
Заготовки парсеров 8 основных ЕТП (список площадок = PlatformSlider на фронте).

Каждый класс — скелет с корректным platform_name и полем normalizer.
Реальный fetch/API/антибот-обход каждой площадки добавляется отдельно;
сейчас fetch_raw возвращает [] и пишет в лог, что адаптер не реализован,
поэтому оркестратор безопасно пропускает площадку.
"""
import logging
from typing import Any

from app.parsers.base import BaseParser

logger = logging.getLogger("app.parsers.platforms")


class _NotImplementedParser(BaseParser):
    """Общая базовая реализация для площадок-заготовок."""

    def __init__(self, api_url: str | None = None, api_key: str | None = None):
        self.api_url = api_url
        self.api_key = api_key

    async def fetch_raw(self) -> list[dict[str, Any]]:
        logger.info("Парсер '%s' не реализован — пропуск", self.platform_name)
        return []

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        title = raw.get("title") or raw.get("name")
        raw_id = raw.get("id") or raw.get("regNum")
        if not title or raw_id is None:
            return None
        return {
            "external_id": self.build_external_id(raw_id),
            "platform": self.platform_name,
            "title": str(title).strip(),
            "description": raw.get("description"),
            "law_type": raw.get("law_type") or self.default_law_type,
            "initial_price": raw.get("initial_price"),
            "region": raw.get("region"),
            "customer_name": raw.get("customer_name"),
            "customer_inn": raw.get("customer_inn"),
            "submission_deadline": self._parse_dt(raw.get("submission_deadline")),
            "status": raw.get("status", "active"),
            "raw_data": raw,
        }


class SberbankASTParser(_NotImplementedParser):
    """Сбербанк-АСТ (sberbank-ast.ru)."""
    platform_name = "sberbank_ast"
    default_law_type = "44-FZ"


class RTSTenderParser(_NotImplementedParser):
    """РТС-тендер (rts-tender.ru)."""
    platform_name = "rts_tender"
    default_law_type = "44-FZ"


class RoseltorgParser(_NotImplementedParser):
    """Росэлторг / ЕЭТП (roseltorg.ru)."""
    platform_name = "roseltorg"
    default_law_type = "44-FZ"


class TekTorgParser(_NotImplementedParser):
    """ТЭК-Торг (tek-torg.ru)."""
    platform_name = "tek_torg"
    default_law_type = "223-FZ"


class GazprombankParser(_NotImplementedParser):
    """Газпромбанк (gzlt.ru / ГПБ)."""
    platform_name = "gazprombank"
    default_law_type = "223-FZ"


class NEPParser(_NotImplementedParser):
    """НЭП — Национальная электронная площадка (etp-nep.ru)."""
    platform_name = "nep"
    default_law_type = "223-FZ"


class EETPParser(_NotImplementedParser):
    """ЕЭТП (Roseltorg, гос. сектор)."""
    platform_name = "eetp"
    default_law_type = "44-FZ"


class AGZRTParser(_NotImplementedParser):
    """АГЗ РТ — Госзаказ РТ (etp.zakazrf.ru)."""
    platform_name = "agz_rt"
    default_law_type = "44-FZ"
