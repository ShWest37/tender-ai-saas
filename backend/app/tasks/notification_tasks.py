"""
Фоновые задачи уведомлений: напоминание об окончании демо-периода.
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.tasks.celery_app import celery_app, run_async
from app.db.session import AsyncSessionLocal
from app.db.models import User
from app.core.config import get_settings
from app.services.notification_service import dispatch_notification

logger = logging.getLogger("app.tasks.notifications")
settings = get_settings()


@celery_app.task(name="app.tasks.notification_tasks.check_demo_expiry")
def check_demo_expiry():
    """
    Шлём напоминание пользователям, у которых демо заканчивается в ближайшие 24 часа
    и которые ещё не подключили платную подписку.
    """
    async def _job():
        now = datetime.now(timezone.utc)
        window_end = now + timedelta(hours=24)
        notified = 0

        async with AsyncSessionLocal() as db:
            users = (await db.execute(select(User).where(User.subscription_plan.is_(None)))).scalars().all()
            for user in users:
                if not user.demo_expires_at:
                    continue
                expires = user.demo_expires_at
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=timezone.utc)
                if now <= expires <= window_end:
                    await dispatch_notification(
                        db, user,
                        notification_type="demo_expiring",
                        title="Демо-доступ скоро закончится",
                        body=f"Демо завершается {expires.strftime('%d.%m.%Y')}. Подключите подписку.",
                        action_url="/dashboard/billing",
                        action_label="Выбрать тариф",
                        email_template="demo_expiring",
                        email_context={
                            "user": user,
                            "demo_expires_at": expires.strftime("%d.%m.%Y"),
                            "frontend_url": settings.FRONTEND_URL,
                        },
                    )
                    notified += 1
            return notified

    count = run_async(_job())
    logger.info("check_demo_expiry: notified %s users", count)
    return count
