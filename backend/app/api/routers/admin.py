"""
Админ-API настроек приложения: выбор категории по умолчанию, демо-период и пр.

GET  /admin/settings — текущие настройки;
PUT  /admin/settings — сохранение настроек.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.dependencies import require_admin
from app.db.models import User
from app.db.session import get_db
from app.schemas.supplier import CategoryOut
from app.services.app_settings import load_admin_settings, save_admin_settings
from app.services.categories import CATEGORY_BY_ID, CATEGORIES, get_default_category, set_default_category
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


class AdminSettingsOut(BaseModel):
    site_name: str
    support_email: str
    admin_email: str
    demo_days: int
    parsing_interval: int
    email_notifications: bool
    max_users: int
    # Выбор категории: по умолчанию IT-оборудование
    default_category: str
    categories: list[CategoryOut]


class AdminSettingsUpdate(BaseModel):
    site_name: Optional[str] = None
    support_email: Optional[str] = None
    admin_email: Optional[str] = None
    demo_days: Optional[int] = Field(default=None, ge=1, le=365)
    parsing_interval: Optional[int] = Field(default=None, ge=1, le=1440)
    email_notifications: Optional[bool] = None
    max_users: Optional[int] = Field(default=None, ge=1)
    default_category: Optional[str] = None


def _category_out(category_id: str, default: str) -> CategoryOut:
    category = CATEGORY_BY_ID[category_id]
    return CategoryOut(
        id=category["id"],
        label=category["label"],
        description=category.get("description", ""),
        is_default=category["id"] == default,
        price_source=category.get("price_source", {}),
        delivery_source=category.get("delivery_source", {}),
    )


async def _build_response(db: AsyncSession) -> AdminSettingsOut:
    raw = await load_admin_settings(db)
    default = await get_default_category(db)
    return AdminSettingsOut(
        site_name=str(raw.get("site_name", "Tender AI Director")),
        support_email=str(raw.get("support_email", "")),
        admin_email=str(raw.get("admin_email", "")),
        demo_days=int(raw.get("demo_days", 3)),
        parsing_interval=int(raw.get("parsing_interval", 15)),
        email_notifications=bool(raw.get("email_notifications", True)),
        max_users=int(raw.get("max_users", 1000)),
        default_category=default,
        categories=[_category_out(n["id"], default) for n in CATEGORIES],
    )


@router.get("/settings", response_model=AdminSettingsOut)
async def get_admin_settings(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await _build_response(db)


@router.put("/settings", response_model=AdminSettingsOut)
async def update_admin_settings(
    payload: AdminSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    data = payload.model_dump(exclude_unset=True)

    # Выбор категории валидируем отдельно: неизвестная категория → ошибка 400
    if "default_category" in data:
        category = data["default_category"]
        if category not in CATEGORY_BY_ID:
            raise HTTPException(status_code=400, detail=f"Неизвестная категория: {category}")
        await set_default_category(db, category)
        data.pop("default_category")

    await save_admin_settings(db, data)
    await db.commit()
    return await _build_response(db)
