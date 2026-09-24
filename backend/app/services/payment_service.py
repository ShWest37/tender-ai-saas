"""
Платёжный сервис поверх YooKassa (SDK синхронный — выносим вызовы в поток).
Планы и цены соответствуют тарифам на лендинге и в billing-странице.
"""
import asyncio
import logging
import uuid
from decimal import Decimal

from yookassa import Configuration, Payment as YooPayment
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import Payment, SubscriptionPlan, User

logger = logging.getLogger("app.services.payments")
settings = get_settings()

# Тариф → цена в рублях (синхронно с PricingCards/billing на фронте)
PLAN_PRICES: dict[str, Decimal] = {
    SubscriptionPlan.START.value: Decimal("15000"),
    SubscriptionPlan.BUSINESS.value: Decimal("35000"),
    SubscriptionPlan.ENTERPRISE.value: Decimal("100000"),
}

PLAN_TITLES: dict[str, str] = {
    SubscriptionPlan.START.value: "Подписка «Старт» (1 месяц)",
    SubscriptionPlan.BUSINESS.value: "Подписка «Бизнес» (1 месяц)",
    SubscriptionPlan.ENTERPRISE.value: "Подписка «Enterprise» (1 месяц)",
}

_configured = False


def _configure_sdk() -> None:
    """Идемпотентная инициализация ключей YooKassa."""
    global _configured
    if not _configured:
        Configuration.configure(settings.YOOKASSA_SHOP_ID, settings.YOOKASSA_SECRET_KEY)
        _configured = True


def _create_payment_sync(plan_value: str, user_email: str, payment_uuid: str):
    """
    Синхронный вызов SDK (выполняется в отдельном потоке).
    payment_uuid передаём в metadata — по нему сопоставим платёж в webhook.
    """
    _configure_sdk()
    params = {
        "amount": {"value": f"{PLAN_PRICES[plan_value]:.2f}", "currency": "RUB"},
        "capture": True,
        "confirmation": {
            "type": "redirect",
            "return_url": f"{settings.FRONTEND_URL}/dashboard/billing?status=success",
        },
        "description": PLAN_TITLES[plan_value],
        "metadata": {"payment_uuid": payment_uuid, "plan": plan_value, "email": user_email},
    }
    # payment_uuid как idempotency key — защита от двойного создания при ретраях
    return YooPayment.create(params, idempotency_key=payment_uuid)


async def create_yookassa_payment(user: User, plan_value: str, db: AsyncSession) -> str:
    """
    Создаёт платёж в YooKassa и сохраняет запись Payment.
    Возвращает confirmation_url для редиректа пользователя.
    """
    if plan_value not in PLAN_PRICES:
        raise ValueError(f"Неизвестный тариф: {plan_value}")

    payment_uuid = uuid.uuid4().hex

    # SDK блокирующий — не вешаем event-loop
    resp = await asyncio.to_thread(_create_payment_sync, plan_value, user.email, payment_uuid)

    record = Payment(
        user_id=user.id,
        yookassa_payment_id=resp.id,
        amount=float(PLAN_PRICES[plan_value]),
        plan=SubscriptionPlan(plan_value),
        status=resp.status,
    )
    db.add(record)
    await db.commit()

    confirmation_url = resp.confirmation.confirmation_url
    logger.info("Created YooKassa payment %s for user %s plan %s", resp.id, user.id, plan_value)
    return confirmation_url
