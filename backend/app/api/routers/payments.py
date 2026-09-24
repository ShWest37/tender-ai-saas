"""
Роутер платежей.
POST /payments/create — создать платёж (нужна авторизация), вернуть confirmation_url.
POST /payments/webhook — приём уведомлений от YooKassa (публичный, без токена).
"""
import ipaddress
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import Payment, User
from app.core.dependencies import get_current_user
from app.core.config import get_settings
from app.schemas.payment import PaymentCreateRequest, PaymentCreateResponse
from app.services.payment_service import create_yookassa_payment
from app.services.subscription_service import activate_or_extend

router = APIRouter()
settings = get_settings()
logger = logging.getLogger("app.api.payments")

# Публичные сети YooKassa для уведомлений. Пусто/development = проверка источника выключена.
YOOKASSA_IP_RANGES = [
    "185.71.76.0/22",
    "185.199.84.0/22",
    "77.75.153.0/25",
    "77.75.154.0/25",
    "2001:6d0:40:300::/56",
]


def _ip_allowed(ip: str) -> bool:
    """Проверка источника webhook по whitelist-сетям YooKassa."""
    if not YOOKASSA_IP_RANGES or settings.APP_ENV.lower() == "development":
        return True
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in ipaddress.ip_network(cidr) for cidr in YOOKASSA_IP_RANGES)


@router.post("/create", response_model=PaymentCreateResponse)
async def create_payment(
    payload: PaymentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        confirmation_url = await create_yookassa_payment(current_user, payload.plan, db)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to create YooKassa payment")
        raise HTTPException(status_code=502, detail=f"Не удалось создать платёж: {exc}")
    return PaymentCreateResponse(confirmation_url=confirmation_url)


async def _process_payment_event(data: dict) -> None:
    """
    Обработка успешного платежа в фоновой задаче (после быстрого 200 OK).
    Своя сессия: фоновая задача живёт вне HTTP-запроса.
    """
    event = data.get("event")
    obj = data.get("object", {})
    payment_id = obj.get("id")

    if event != "payment.succeeded" or not payment_id:
        return

    async with AsyncSessionLocal() as db:
        payment = (
            await db.execute(select(Payment).where(Payment.yookassa_payment_id == payment_id))
        ).scalar_one_or_none()
        if payment is None:
            logger.warning("Webhook for unknown payment %s", payment_id)
            return
        if payment.status == "succeeded":
            return  # идемпотентность: повторно не продлеваем

        payment.status = "succeeded"
        user = (await db.execute(select(User).where(User.id == payment.user_id))).scalar_one_or_none()
        if user is not None:
            await activate_or_extend(user, payment.plan, db)
        await db.commit()


@router.post("/webhook")
async def payment_webhook(request: Request, background_tasks: BackgroundTasks):
    forwarded = request.headers.get("X-Forwarded-For", "")
    source_ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "")

    if not _ip_allowed(source_ip):
        logger.warning("Rejected webhook from IP %s", source_ip)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden source")

    data = await request.json()
    # Отвечаем 200 сразу; тяжёлую работу — в фоне (YooKassa ждёт 2xx за 16 сек)
    background_tasks.add_task(_process_payment_event, data)
    return {"status": "accepted"}
