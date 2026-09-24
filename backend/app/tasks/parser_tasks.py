"""
Фоновые задачи парсинга ЕТП.
parse_all_platforms — обход всех активных ParserConfig (ставится в очередь beat'ом).
parse_platform — парсинг одной площадки (upsert Tender, обновление ParserConfig).
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.tasks.celery_app import celery_app, run_async
from app.db.session import AsyncSessionLocal
from app.db.models import ParserConfig, Tender
from app.parsers.registry import build_parser

logger = logging.getLogger("app.tasks.parsers")


async def _upsert_tender(db, data: dict) -> bool:
    """Вставляет тендер по external_id; если есть — обновляет. True, если создан новый."""
    existing = (
        await db.execute(select(Tender).where(Tender.external_id == data["external_id"]))
    ).scalar_one_or_none()

    if existing is not None:
        return False

    db.add(Tender(**data))
    return True


async def _run_platform(platform_name: str) -> dict:
    """Парсит одну площадку в своей сессии. Возвращает статистику."""
    async with AsyncSessionLocal() as db:
        config = (
            await db.execute(select(ParserConfig).where(ParserConfig.platform_name == platform_name))
        ).scalar_one_or_none()

        parser = build_parser(
            platform_name,
            api_url=config.api_url if config else None,
            api_key=config.api_key if config else None,
        )
        if parser is None:
            logger.warning("Unknown platform %s", platform_name)
            return {"platform": platform_name, "error": "unknown platform"}

        try:
            raw_items = await parser.fetch_raw()
            created = 0
            for raw in raw_items:
                normalized = parser.normalize(raw)
                if not normalized:
                    continue
                if await _upsert_tender(db, normalized):
                    created += 1
            await db.commit()

            if config is not None:
                config.last_run_at = datetime.now(timezone.utc)
                config.last_error = None
                await db.commit()

            logger.info("Platform %s: fetched=%s created=%s", platform_name, len(raw_items), created)
            return {"platform": platform_name, "fetched": len(raw_items), "created": created}

        except Exception as exc:  # noqa: BLE001
            await db.rollback()
            if config is not None:
                config.last_run_at = datetime.now(timezone.utc)
                config.last_error = str(exc)[:2000]
                await db.commit()
            logger.exception("Platform %s parse failed", platform_name)
            return {"platform": platform_name, "error": str(exc)}


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
