"""
Тестовая обвязка: in-memory SQLite (aiosqlite) + переопределение get_db.
Docker не нужен — схема (включая pgvector-колонку) создаётся через metadata.create_all.
"""
import os
import sys
import tempfile
import uuid
from pathlib import Path

# Пути и env до импорта приложения
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models import Base
from app.db.session import get_db
from app.main import app


@pytest_asyncio.fixture
async def engine():
    """
    Свежая БД на каждый тест во временном файле.
    Файл (а не :memory:) — чтобы несколько параллельных сессий (клиент + сид)
    работали на одном соединении без конфликта checkout.
    """
    db_path = Path(tempfile.gettempdir()) / f"test_{uuid.uuid4().hex}.sqlite"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()
    if db_path.exists():
        db_path.unlink()


@pytest_asyncio.fixture
async def session(engine):
    maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s


@pytest_asyncio.fixture
async def db_factory(engine):
    """Фабрика коротких сессий для сидинга данных из теста."""
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def client(engine):
    """ASGI-клиент с переопределённой зависимостью get_db на тестовую БД."""
    maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with maker() as s:
            try:
                yield s
            except Exception:
                await s.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(client):
    """Клиент с активным Bearer-токеном зарегистрированного пользователя (демо-доступ активен)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "user@example.com",
            "password": "password123",
            "full_name": "Иван Тестов",
            "company_name": "ООО Тест",
            "inn": "1234567890",
        },
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
