"""
Точка входа FastAPI-приложения Tender AI Director.

Запуск: uvicorn app.main:app --host 0.0.0.0 --port 8000
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, generate_latest
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import init_db, close_db
from app.api.router import api_router

settings = get_settings()
configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger("app.main")

# Rate limiter для публичных эндпоинтов (auth, webhook платежей)
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


async def lifespan(app: FastAPI):
    """Старт: инициализация схемы БД + pgvector. Стоп: освобождение пула."""
    logger.info("Starting Tender AI Director backend (env=%s)", settings.APP_ENV)
    try:
        await init_db()
        logger.info("Database initialized (pgvector ready)")
    except Exception as exc:  # noqa: BLE001
        # В проде схему накатывает Alembic; сбой init_db не должен ронять процесс
        logger.warning("init_db skipped: %s", exc)
    yield
    await close_db()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Tender AI Director API",
    version="1.0.0",
    description="Backend SaaS для автоматизации тендеров: поиск, AI-генерация заявок, аналитика.",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Основной API под /api/v1 (базу для фронта NEXT_PUBLIC_API_URL задаёт целиком)
app.include_router(api_router, prefix="/api/v1")


# === Prometheus-метрики ===
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Считаем запросы по маршруту. path берём из route template, чтобы не раздувать лейблы."""
    response = await call_next(request)
    route = request.scope.get("route")
    path = getattr(route, "path", request.url.path)
    REQUEST_COUNT.labels(request.method, path, response.status_code).inc()
    return response


@app.get("/health", tags=["system"])
async def health() -> dict:
    """Liveness-проба для Docker healthcheck и балансировщика."""
    return {"status": "ok", "env": settings.APP_ENV}


@app.get("/metrics", tags=["system"])
async def metrics() -> Response:
    """Метрики Prometheus для сервиса prometheus из docker-compose."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})
