"""
Продление подписки после успешной оплаты.
Логика: активная подписка продлевается от текущей даты окончания, иначе — от «сейчас».
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SubscriptionPlan, User

logger = logging.getLogger("app.services.subscriptions")

SUBSCRIPTION_DAYS = 30


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def activate_or_extend(
    user: User,
    plan: SubscriptionPlan,
    db: AsyncSession,
) -> datetime:
    """Возвращает новую дату окончания подписки."""
    now = datetime.now(timezone.utc)

    # Продлеваем от ещё действующей подписки, иначе — от текущего момента
    if user.subscription_expires_at and _aware(user.subscription_expires_at) > now:
        base = _aware(user.subscription_expires_at)
    else:
        base = now

    new_expiry = base + timedelta(days=SUBSCRIPTION_DAYS)
    user.subscription_plan = plan
    user.subscription_expires_at = new_expiry
    await db.commit()

    logger.info("User %s activated plan %s until %s", user.id, plan.value, new_expiry)
    return new_expiry
