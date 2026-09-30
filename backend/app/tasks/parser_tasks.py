"""
Фоновые задачи парсинга ЕТП.
parse_all_platforms — обход всех активных ParserConfig (ставится в очередь beat'ом).
parse_platform — парсинг одной площадки (upsert Tender, обновление ParserConfig).

Сама логика парсинга живёт в app.services.platform_service — её же вызывает
админ-API (раздел «Тендерные площадки»), чтобы результаты были одинаковыми.
"""
import logging

from sqlalchemy import select

from app.tasks.celery_app import celery_app, run_async
from app.db.session import AsyncSessionLocal
from app.db.models import ParserConfig
from app.services.platform_service import run_platform_parse

logger = logging.getLogger("app.tasks.parsers")


async def _run_platform(platform_name: str) -> dict:
    """Парсит одну площадку в своей сессии. Возвращает статистику."""
    async with AsyncSessionLocal() as db:
        return await run_platform_parse(db, platform_name)


@celery_app.task(name="app.tasks.parser_tasks.parse_platform")
def parse_platform(platform_name: str):
    return run_async(_run_platform(platform_name))


@celery_app.task(name="app.tasks.parser_tasks.parse_all_platforms")
def parse_all_platforms():
    """
    Обходит ParserConfig с is_active=True. Если конфига нет — используем реестр целиком,
    чтобы парсинг работал и до заполнения таблицы ParserConfig.
    """
    async def _collect() -> list[str]:
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(select(ParserConfig).where(ParserConfig.is_active.is_(True)))).scalars().all()
            if rows:
                return [r.platform_name for r in rows]
        # Fallback: все известные площадки из реестра
        from app.parsers.registry import PARSER_REGISTRY
        return list(PARSER_REGISTRY.keys())

    platforms = run_async(_collect())
    results = [run_async(_run_platform(name)) for name in platforms]
    return results
