"""Схемы тендерных площадок: админ-таблица, добавление по API, ЛК пользователя."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PlatformOut(BaseModel):
    """Строка таблицы «Тендерные площадки» в админ-панели."""
    id: int
    platform_name: str
    name: str
    url: Optional[str] = None
    api_url: Optional[str] = None
    is_active: bool
    status: str  # active | error | pending | inactive
    last_run_at: Optional[datetime] = None
    last_error: Optional[str] = None


class PlatformCreate(BaseModel):
    """Добавление площадки администратором (по сайту и/или API-адресу)."""
    name: str = Field(min_length=1, max_length=200)
    url: Optional[str] = Field(default=None, max_length=500)
    api_url: Optional[str] = Field(default=None, max_length=500)
    api_key: Optional[str] = Field(default=None, max_length=500)

    @field_validator("url", "api_url")
    @classmethod
    def _http_only(cls, value: Optional[str]) -> Optional[str]:
        if value:
            value = value.strip()
            if not value.lower().startswith(("http://", "https://")):
                raise ValueError("Адрес должен начинаться с http:// или https://")
        return value or None


class PlatformCreateOut(BaseModel):
    platform: PlatformOut
    # Результат быстрой проверки API-адреса (null, если API не указывался)
    probe: Optional[dict] = None


class PlatformUpdate(BaseModel):
    is_active: bool


class PlatformPublicOut(BaseModel):
    """Площадка в ЛК пользователя — доступна для подачи заявок."""
    id: int
    name: str
    url: Optional[str] = None
    status: str


class ParseResult(BaseModel):
    """Результат прогона одной площадки (формат раздела «Парсинг»)."""
    platform: str
    platform_name: str
    status: str  # success | error
    tenders_found: int = 0
    created: int = 0
    message: str = ""


class ParseReport(BaseModel):
    results: list[ParseResult] = []
    total: int = 0
    success: int = 0
    created: int = 0
