"""
Отправка уведомлений о платежах пользователю и администратору.
"""
import logging

from app.services.email_service import send_email

logger = logging.getLogger("app.services.payment_notification")


async def send_payment_notification(
    user_email: str,
    admin_email: str,
    plan: str,
    amount: float,
) -> None:
    """
    Отправляет уведомление о успешной оплате:
    - Пользователю: подтверждение оплаты и активации подписки
    - Администратору: уведомление о новом платеже
    """
    # Уведомление пользователю
    user_subject = "Подписка активирована — Tender AI Director"
    user_body = f"""
Здравствуйте!

Ваша подписка успешно активирована.

Детали платежа:
- Тариф: {plan}
- Сумма: {amount:,.2f} ₽
- Дата: {__import__('datetime').datetime.now().strftime('%d.%m.%Y %H:%M')}

Спасибо, что выбрали Tender AI Director!

С уважением,
Команда Tender AI
"""
    await send_email(user_email, user_subject, user_body)

    # Уведомление администратору
    admin_subject = f"Новый платёж — {plan}"
    admin_body = f"""
Поступил новый платёж:

- Email пользователя: {user_email}
- Тариф: {plan}
- Сумма: {amount:,.2f} ₽
- Дата: {__import__('datetime').datetime.now().strftime('%d.%m.%Y %H:%M')}
"""
    await send_email(admin_email, admin_subject, admin_body)

    logger.info("Payment notification sent to user %s and admin %s", user_email, admin_email)
