"""
Скрипт для создания администратора.
Запуск: python create_admin.py
"""
import asyncio
import os

import bcrypt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://tender_user:tender_password@localhost:5432/tender_db"
)

ADMIN_EMAIL = "admin@tenderai.ru"
ADMIN_PASSWORD = "admin123"


def hash_password(password: str) -> str:
    """Хеширование пароля с помощью bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


async def create_admin():
    """Создание администратора."""
    engine = create_async_engine(DATABASE_URL)

    hashed_password = hash_password(ADMIN_PASSWORD)

    async with engine.begin() as conn:
        # Проверяем, существует ли уже администратор
        result = await conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": ADMIN_EMAIL}
        )
        existing = result.fetchone()

        if existing:
            # Обновляем пароль и роль
            await conn.execute(
                text("""
                    UPDATE users
                    SET hashed_password = :hashed_password, role = 'ADMIN'
                    WHERE email = :email
                """),
                {"hashed_password": hashed_password, "email": ADMIN_EMAIL}
            )
            print(f"Администратор обновлён: {ADMIN_EMAIL}")
        else:
            # Создаём нового администратора
            await conn.execute(
                text("""
                    INSERT INTO users (email, hashed_password, full_name, role, is_active)
                    VALUES (:email, :hashed_password, :full_name, 'ADMIN', true)
                """),
                {
                    "email": ADMIN_EMAIL,
                    "hashed_password": hashed_password,
                    "full_name": "Администратор",
                }
            )
            print(f"Администратор создан: {ADMIN_EMAIL}")

        await conn.commit()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_admin())
