"""Тесты блога: видны только опубликованные посты, статья по slug, 404 для черновика."""
import pytest
from datetime import datetime, timezone

from app.db.models import BlogPost


async def _seed_blog(db_factory):
    async with db_factory() as s:
        s.add_all([
            BlogPost(title="Опубликовано", slug="published", content="# Привет",
                     excerpt="кратко", is_published=True,
                     published_at=datetime.now(timezone.utc)),
            BlogPost(title="Черновик", slug="draft-post", content="секрет",
                     is_published=False),
        ])
        await s.commit()


async def test_list_only_published(client, db_factory):
    await _seed_blog(db_factory)
    resp = await client.get("/api/v1/blog")
    assert resp.status_code == 200
    slugs = {p["slug"] for p in resp.json()}
    assert slugs == {"published"}


async def test_get_post_by_slug(client, db_factory):
    await _seed_blog(db_factory)
    resp = await client.get("/api/v1/blog/published")
    assert resp.status_code == 200
    body = resp.json()
    assert body["content"] == "# Привет"


async def test_get_unpublished_404(client, db_factory):
    await _seed_blog(db_factory)
    resp = await client.get("/api/v1/blog/draft-post")
    assert resp.status_code == 404


async def test_get_missing_404(client):
    resp = await client.get("/api/v1/blog/nope")
    assert resp.status_code == 404
