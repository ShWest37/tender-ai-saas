"""
Блог: рубрики, поиск, структура списка статей.
"""
from datetime import datetime, timezone


async def _seed(db_factory):
    from app.db.models import BlogPost

    async with db_factory() as s:
        s.add_all([
            BlogPost(
                title="Как AI сокращает время на подготовку заявок",
                slug="ai-applications",
                content="# AI в тендерах",
                excerpt="Разбираем, как ИИ помогает готовить заявки",
                category="AI в тендерах",
                is_published=True,
                published_at=datetime.now(timezone.utc),
            ),
            BlogPost(
                title="44-ФЗ: типичные ошибки поставщиков",
                slug="44fz-mistakes",
                content="# Ошибки",
                excerpt="Частые ошибки при подаче",
                category="Право",
                is_published=True,
                published_at=datetime.now(timezone.utc),
            ),
            BlogPost(
                title="Черновик про 223-ФЗ",
                slug="draft-223",
                content="черновик",
                category="Право",
                is_published=False,
            ),
        ])
        await s.commit()


async def test_filter_by_category(client, db_factory):
    await _seed(db_factory)
    resp = await client.get("/api/v1/blog", params={"category": "Право"})
    assert resp.status_code == 200, resp.text
    posts = resp.json()
    assert len(posts) == 1
    assert posts[0]["slug"] == "44fz-mistakes"
    assert posts[0]["category"] == "Право"
    assert resp.headers.get("X-Total-Count") == "1"


async def test_search_by_query(client, db_factory):
    await _seed(db_factory)
    resp = await client.get("/api/v1/blog", params={"query": "ошибки"})
    assert resp.status_code == 200
    posts = resp.json()
    assert len(posts) == 1
    assert posts[0]["slug"] == "44fz-mistakes"


async def test_search_returns_total(client, db_factory):
    await _seed(db_factory)
    resp = await client.get("/api/v1/blog")
    assert resp.headers.get("X-Total-Count") == "2"


async def test_categories_endpoint(client, db_factory):
    await _seed(db_factory)
    resp = await client.get("/api/v1/blog/categories")
    assert resp.status_code == 200
    categories = {c["category"]: c["count"] for c in resp.json()}
    # Черновики не попадают в рубрики
    assert categories == {"AI в тендерах": 1, "Право": 1}
