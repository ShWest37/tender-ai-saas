"""
Асинхронный слой подключения к PostgreSQL.

Возвращает:
- engine            — общий движок SQLAlchemy (один на процесс)
- AsyncSessionLocal — фабрика сессий (async context manager)
- get_db            — FastAPI-зависимость, отдающая AsyncSession на запрос
- Base              — общий DeclarativeBase (реэкспорт из models)
- init_db()         — создание расширения pgvector и таблиц (dev/тесты)
"""
import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.db.models import Base  # реэкспорт: единая точка доступа к metadata

logger = logging.getLogger("app.db.session")

settings = get_settings()

# echo=debug только в локальной разработке
_echo = settings.APP_ENV.lower() == "development"

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=_echo,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Зависимость FastAPI: одна сессия на HTTP-запрос.
    Откат при необработанной ошибке, гарантированное закрытие.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """
    Служебная инициализация схемы:
    1) включает расширение vector (pgvector) — нужно до создания knowledge_documents;
    2) создаёт отсутствующие таблицы (в проде это делает Alembic, здесь — dev/тесты);
    3) аддитивно добавляет недостающие колонки в существующие таблицы:
       в Docker-образе миграции отдельно не запускаются, а create_all не умеет
       менять уже существующие таблицы.
    """
    from sqlalchemy import inspect as sa_inspect, text

    async with engine.begin() as conn:
        # pgvector обязателен для Column(Vector(768)) в knowledge_documents
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

        def _add_missing_columns(sync_conn) -> None:
            inspector = sa_inspect(sync_conn)
            tables = set(inspector.get_table_names())
            for table in Base.metadata.sorted_tables:
                if table.name not in tables:
                    continue
                existing = {c["name"] for c in inspector.get_columns(table.name)}
                for column in table.columns:
                    if column.name in existing:
                        continue
                    if not column.nullable and column.server_default is None:
                        logger.warning(
                            "Схема: пропуск %s.%s (NOT NULL без server_default)",
                            table.name,
                            column.name,
                        )
                        continue
                    col_type = column.type.compile(dialect=sync_conn.dialect)
                    sync_conn.execute(
                        text(f"ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}")
                    )
                    logger.info("Схема: добавлена колонка %s.%s", table.name, column.name)

        await conn.run_sync(_add_missing_columns)


async def close_db() -> None:
    """Корректно освобождает пул соединений при остановке приложения."""
    await engine.dispose()
