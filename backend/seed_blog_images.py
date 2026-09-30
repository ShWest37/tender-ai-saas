"""
Скрипт для добавления уникальных смысловых изображений к статьям блога.
Запуск: python seed_blog_images.py
"""
import asyncio
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://tender_user:tender_password@localhost:5432/tender_db"
)

# Уникальные смысловые изображения для каждой статьи
ARTICLE_IMAGES = {
    "ai-tender-trends-2026": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
    "ai-critic-reduce-rejections": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80",
    "automation-step-by-step-guide": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    "rag-technology-tenders": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    "predictive-analytics-tenders": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    "edp-platforms-integration-guide": "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&q=80",
}


async def seed_blog_images():
    """Добавление изображений к статьям."""
    engine = create_async_engine(DATABASE_URL)

    async with engine.begin() as conn:
        for slug, image_url in ARTICLE_IMAGES.items():
            result = await conn.execute(
                text("UPDATE blog_posts SET cover_image_url = :image_url WHERE slug = :slug"),
                {"image_url": image_url, "slug": slug}
            )
            if result.rowcount > 0:
                print(f"Обновлено изображение для: {slug}")
            else:
                print(f"Статья не найдена: {slug}")

        await conn.commit()
        print("\nВсе изображения успешно добавлены!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_blog_images())
