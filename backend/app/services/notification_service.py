"""
Диспетчер уведомлений.
Правило из models.py: in-app уведомления создаются ВСЕГДА,
email/MAX — по NotificationPreference (канал на каждый тип + глобальные флаги).
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    InAppNotification,
    Notification,
    NotificationPreference,
    NotificationChannel,
    NotificationType,
    User,
)
from app.services.email_service import send_email
from app.services.max_service import send_max_message

logger = logging.getLogger("app.services.notifications")

# NotificationType → имя поля канала в NotificationPreference
CHANNEL_FIELD_BY_TYPE: dict[str, str] = {
    NotificationType.NEW_TENDER_FOUND.value: "new_tender_channel",
    NotificationType.APPLICATION_SUBMITTED.value: "application_submitted_channel",
    NotificationType.APPLICATION_ACCEPTED.value: "application_accepted_channel",
    NotificationType.APPLICATION_REJECTED.value: "application_rejected_channel",
    NotificationType.TENDER_WON.value: "tender_won_channel",
    NotificationType.TENDER_LOST.value: "tender_lost_channel",
    NotificationType.PAYMENT_SUCCESS.value: "payment_success_channel",
    NotificationType.DEMO_EXPIRING.value: "demo_expiring_channel",
    NotificationType.AI_GENERATION_COMPLETE.value: "ai_generation_complete_channel",
}


async def get_or_create_preference(db: AsyncSession, user_id: int) -> NotificationPreference:
    pref = (
        await db.execute(select(NotificationPreference).where(NotificationPreference.user_id == user_id))
    ).scalar_one_or_none()
    if pref is None:
        pref = NotificationPreference(user_id=user_id)
        db.add(pref)
        await db.flush()
    return pref


async def dispatch_notification(
    db: AsyncSession,
    user: User,
    notification_type: str,
    title: str,
    body: str,
    related_tender_id: Optional[int] = None,
    related_application_id: Optional[int] = None,
    action_url: Optional[str] = None,
    action_label: Optional[str] = None,
    email_template: Optional[str] = None,
    email_context: Optional[dict] = None,
) -> None:
    """
    1) In-app — всегда.
    2) Email/MAX — по каналу конкретного типа и глобальным флагам pref.
    """
    # 1. In-app (колокольчик) — безусловно
    db.add(
        InAppNotification(
            user_id=user.id,
            notification_type=notification_type,
            title=title,
            body=body,
            related_tender_id=related_tender_id,
            related_application_id=related_application_id,
            action_url=action_url,
            action_label=action_label,
        )
    )

    pref = await get_or_create_preference(db, user.id)

    field = CHANNEL_FIELD_BY_TYPE.get(notification_type)
    channel = getattr(pref, field, NotificationChannel.EMAIL) if field else NotificationChannel.EMAIL

    want_email = channel in (NotificationChannel.EMAIL, NotificationChannel.BOTH) and pref.email_enabled
    want_max = channel in (NotificationChannel.MAX_MESSENGER, NotificationChannel.BOTH) and pref.max_enabled

    sent_channels = []

    # 2. Email
    if want_email and email_template:
        ok = await send_email(user.email, title, email_template, email_context or {"title": title, "body": body, "user": user})
        if ok:
            sent_channels.append("email")
            db.add(Notification(user_id=user.id, channel="email", type=notification_type,
                                title=title, body=body, sent_at=datetime.now(timezone.utc)))

    # 3. MAX
    if want_max and pref.max_chat_id:
        ok = await send_max_message(pref.max_chat_id, f"{title}\n{body}")
        if ok:
            sent_channels.append("max")
            db.add(Notification(user_id=user.id, channel="max", type=notification_type,
                                title=title, body=body, sent_at=datetime.now(timezone.utc)))

    await db.commit()
    logger.info("Notification %s for user %s -> channels=%s", notification_type, user.id, sent_channels or ["in_app"])
