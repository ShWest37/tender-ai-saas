"""
Celery-приложение: broker/backend из настроек, beat-расписание,
обёртка run_async для запуска корутин из синхронных воркеров.

Запуск (см. docker-compose.yml):
  celery -A app.tasks.celery_app worker --loglevel=info
  celery -A app.tasks.celery_app beat --loglevel=info
"""
import asyncio

from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()
configure_logging(settings.LOG_LEVEL)

celery_app = Celery(
    "tender_ai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.parser_tasks",
        "app.tasks.ai_tasks",
        "app.tasks.notification_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Moscow",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_time_limit=600,          # жёсткий лимит на генерацию LLM
    task_soft_time_limit=540,
    broker_connection_retry_on_startup=True,
)


def run_async(coro):
    """
    Запуск корутины из синхронного Celery-воркера.
    Каждый вызов — свой event-loop; движок освобождается, чтобы пул
    не держал соединения из уже закрытого цикла.
    """
    async def _runner():
        from app.db.session import engine
        try:
            return await coro
        finally:
            await engine.dispose()

    return asyncio.run(_runner())


# === Beat: периодические задачи ===
celery_app.conf.beat_schedule = {
    # Парсинг всех активных площадок каждые 15 минут (как обещано на лендинге)
    "parse-all-platforms": {
        "task": "app.tasks.parser_tasks.parse_all_platforms",
        "schedule": crontab(minute="*/15"),
    },
    # Проверка истекающих демо-периодов ежедневно в 09:00
    "check-demo-expiry": {
        "task": "app.tasks.notification_tasks.check_demo_expiry",
        "schedule": crontab(hour=9, minute=0),
    },
}
