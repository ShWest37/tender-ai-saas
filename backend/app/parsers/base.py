"""
Базовый класс парсера электронной торговой площадки.

Контракт: парсер умеет скачивать «сырые» записи площадки и приводить их
к словарю с полями модели Tender. Запись в БД и обновление ParserConfig
делает оркестратор (parser_tasks), парсер отвечают только за fetch + normalize.
"""
import abc
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("app.parsers")


class BaseParser(abc.ABC):
    """Абстрактный парсер одной ЕТП."""

    # Имя должно совпадать с ParserConfig.platform_name
    platform_name: str = "base"
    # Закон по умолчанию для площадки (44-FZ / 223-FZ / commercial)
    default_law_type: str | None = None

    @abc.abstractmethod
    async def fetch_raw(self) -> list[dict[str, Any]]:
        """Возвращает сырные записи площадки (API/HTML/XML)."""
        raise NotImplementedError

    @abc.abstractmethod
    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        """
        Приводит сырую запись к полям модели Tender.
        Обязательное поле — title; без него запись отбрасывается (вернуть None).
        Должен включать external_id для дедупликации.
        """
        raise NotImplementedError

    def external_id(self, raw: dict[str, Any]) -> str:
        """Уникальный id записи на площадке; переопределяется при необходимости."""
        return f"{self.platform_name}:{raw.get('id')}"

    def build_external_id(self, raw_id: Any) -> str:
        return f"{self.platform_name}:{raw_id}"

    @staticmethod
    def _parse_dt(value: Any) -> datetime | None:
        """Пытается распарсить ISO-дату; при неудаче — None."""
        if not value:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            return None
