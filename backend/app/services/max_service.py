"""
Отправка уведомлений в MAX через Bot API (аналогично Telegram-боту).
Токен и chat_id приходят из настроек/профиля пользователя.
"""
import logging

import httpx

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("app.services.max")

# Базовый адрес Bot API MAX (можно переопределить переменной окружения при смене версии API)
MAX_API_BASE = "https://max-api.ru/api/v3"


def is_max_configured() -> bool:
    return bool(settings.MAX_BOT_TOKEN)


async def send_max_message(chat_id: str, text: str) -> bool:
    """
    Отправляет текст в чат MAX. Возвращает False при отсутствии настроек/ошибке —
    уведомление не должно ронять основную операцию.
    """
    if not is_max_configured() or not chat_id:
        logger.info("MAX не настроен или пустой chat_id — сообщение пропущено")
        return False

    url = f"{MAX_API_BASE}/chats/{chat_id}/messages"
    headers = {"Authorization": f"Bearer {settings.MAX_BOT_TOKEN}"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json={"text": text}, headers=headers)
            resp.raise_for_status()
        logger.info("MAX message sent to chat %s", chat_id)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("MAX send failed to chat %s: %s", chat_id, exc)
        return False
