"""
Глобальные настройки приложения (хранилище ключ → значение в app_settings).

Дефолты берутся из Settings (.env), значения администратора их переопределяют.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import AppSetting

# Ключи, которые админ-панель читает/пишет напрямую
SETTING_KEYS = (
    "site_name",
    "support_email",
    "admin_email",
    "demo_days",
    "parsing_interval",
    "email_notifications",
    "max_users",
    "default_category",
)


async def get_setting(db: AsyncSession, key: str, default: Any = None) -> Any:
    row = (await db.execute(select(AppSetting).where(AppSetting.key == key))).scalar_one_or_none()
    if row is None or row.value_json is None:
        return default
    return row.value_json


async def set_setting(db: AsyncSession, key: str, value: Any) -> None:
    row = (await db.execute(select(AppSetting).where(AppSetting.key == key))).scalar_one_or_none()
    if row is None:
        db.add(AppSetting(key=key, value_json=value))
    else:
        row.value_json = value
    await db.flush()


async def get_demo_days(db: AsyncSession) -> int:
    """Сколько дней демо-доступа выдаётся при регистрации (админ может изменить)."""
    value = await get_setting(db, "demo_days")
    try:
        days = int(value)
    except (TypeError, ValueError):
        days = get_settings().DEMO_DAYS
    return days if days > 0 else get_settings().DEMO_DAYS


async def load_admin_settings(db: AsyncSession) -> dict[str, Any]:
    """Текущие настройки для админ-панели (значения по умолчанию из .env)."""
    settings = get_settings()
    defaults: dict[str, Any] = {
        "site_name": "Tender AI Director",
        "support_email": "support@bidflow.ru",
        "admin_email": "admin@bidflow.ru",
        "demo_days": settings.DEMO_DAYS,
        "parsing_interval": 15,
        "email_notifications": True,
        "max_users": 1000,
    }
    for key in SETTING_KEYS:
        value = await get_setting(db, key)
        if value is not None:
            defaults[key] = value
    return defaults


async def save_admin_settings(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    """Сохраняет только известные ключи (и только переданные). Возвращает итог."""
    for key in SETTING_KEYS:
        if key in payload and payload[key] is not None:
            await set_setting(db, key, payload[key])
    await db.flush()
    return await load_admin_settings(db)
