"""
Конфигурация приложения.
Все настройки берутся из переменных окружения (.env файл).
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"
    DEMO_DAYS: int = 3
    LOG_LEVEL: str = "INFO"

    # CORS: список разрешённых origin'ов через запятую.
    # Для разработки по умолчанию открыт локальный фронтенд.
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # КриптоПро (ЭЦП) — путь к утилитам подписи на сервере
    CRYPTO_PRO_PATH: str = "/opt/cprocsp"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # YooKassa
    YOOKASSA_SHOP_ID: str = ""
    YOOKASSA_SECRET_KEY: str = ""
    YOOKASSA_WEBHOOK_URL: str = ""

    # AI
    YANDEX_GPT_API_KEY: str = ""
    YANDEX_GPT_FOLDER_ID: str = ""
    GIGACHAT_CLIENT_ID: str = ""
    GIGACHAT_CLIENT_SECRET: str = ""
    DEFAULT_LLM_PROVIDER: str = "yandex_gpt"

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@example.com"

    # MAX Messenger
    MAX_BOT_TOKEN: str = ""
    MAX_WEBHOOK_URL: str = ""

    # Grafana
    GRAFANA_ADMIN_PASSWORD: str = "admin123"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def cors_origins_list(self) -> list[str]:
        """CORS_ORIGINS как список строк (пустые элементы отбрасываются)."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() in ("production", "prod")


@lru_cache()
def get_settings() -> Settings:
    return Settings()