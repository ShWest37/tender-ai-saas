"""
Отправка email через aiosmtplib. Шаблоны — Jinja2 из app/templates/email.
SMTP-учётки Postmark берутся из настроек.
"""
import logging
from pathlib import Path

import aiosmtplib
from email.message import EmailMessage
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("app.services.email")

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

_jinja = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "txt"]),
)


def is_email_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER)


async def send_email(to: str, subject: str, template_name: str, context: dict) -> bool:
    """
    Рендерит html/txt шаблон и отправляет письмо.
    Возвращает False, если SMTP не настроен или отправка упала (не роняем бизнес-операцию).
    """
    if not is_email_configured():
        logger.warning("SMTP не настроен — письмо '%s' пропущено", subject)
        return False

    html = _jinja.get_template(f"{template_name}.html.j2").render(**context)
    txt = _jinja.get_template(f"{template_name}.txt.j2").render(**context)

    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(txt)
    message.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Email send failed to %s: %s", to, exc)
        return False
