"""
Роутер уведомлений.
In-app (колокольчик TopBar): список, счётчик непрочитанных, отметки.
Настройки каналов: GET/PUT preferences.
MAX: приём webhook'ов от бота.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import InAppNotification, User
from app.core.dependencies import get_current_user
from app.schemas.notification import (
    InAppNotificationOut,
    UnreadCountOut,
    NotificationPreferenceOut,
    NotificationPreferenceUpdate,
)
from app.services.notification_service import get_or_create_preference

router = APIRouter()


@router.get("", response_model=list[InAppNotificationOut])
async def list_in_app(
    only_unread: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(InAppNotification).where(InAppNotification.user_id == current_user.id)
    if only_unread:
        stmt = stmt.where(InAppNotification.is_read.is_(False))
    stmt = stmt.order_by(InAppNotification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = (
        await db.execute(
            select(func.count(InAppNotification.id)).where(
                InAppNotification.user_id == current_user.id,
                InAppNotification.is_read.is_(False),
            )
        )
    ).scalar_one()
    return UnreadCountOut(unread_count=total or 0)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        update(InAppNotification)
        .where(InAppNotification.id == notification_id, InAppNotification.user_id == current_user.id)
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Уведомление не найдено")
    await db.commit()


@router.post("/read-all", response_model=UnreadCountOut)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(InAppNotification)
        .where(InAppNotification.user_id == current_user.id, InAppNotification.is_read.is_(False))
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return UnreadCountOut(unread_count=0)


@router.get("/preferences", response_model=NotificationPreferenceOut)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_or_create_preference(db, current_user.id)


@router.put("/preferences", response_model=NotificationPreferenceOut)
async def update_preferences(
    payload: NotificationPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pref = await get_or_create_preference(db, current_user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(pref, key, value)
    await db.commit()
    await db.refresh(pref)
    return pref


@router.post("/max/webhook")
async def max_webhook(request: Request):
    """
    Webhook от MAX-бота: подтверждение подписки на уведомления.
    Ответ 200 обязателен, иначе MAX считает доставку неуспешной.
    Сопоставление чата с пользователем выполняется по max_chat_id в настройках.
    """
    data = await request.json()
    # Эхо-запрос при регистрации webhook'а
    if data.get("type") == "url_verification":
        return {"challenge": data.get("challenge")}
    return {"status": "ok"}
