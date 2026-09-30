"""
Админ-настройки: выбор категории по умолчанию и демо-период.
"""
from datetime import datetime, timedelta, timezone

from app.db.models import User, UserRole


async def _make_admin(client, db_factory, email: str = "root@example.com"):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Админ"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    async with db_factory() as s:
        from sqlalchemy import update

        await s.execute(update(User).where(User.email == email).values(role=UserRole.ADMIN))
        await s.commit()
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


async def test_settings_default_category_is_it_equipment(client, db_factory):
    await _make_admin(client, db_factory)
    resp = await client.get("/api/v1/admin/settings")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["default_category"] == "it_equipment"
    assert body["demo_days"] == 3
    labels = {n["id"]: n["label"] for n in body["categories"]}
    assert "IT-оборудование" in labels["it_equipment"]


async def test_settings_require_admin(auth_client):
    resp = await auth_client.get("/api/v1/admin/settings")
    assert resp.status_code == 403


async def test_update_default_category(client, db_factory):
    await _make_admin(client, db_factory)
    resp = await client.put("/api/v1/admin/settings", json={"default_category": "construction"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["default_category"] == "construction"
    selected = next(n for n in body["categories"] if n["id"] == "construction")
    assert selected["is_default"] is True

    # Настройка сохранилась и видна в каталоге категорий
    categories = await client.get("/api/v1/suppliers/categories")
    assert categories.json()["default"] == "construction"


async def test_update_rejects_unknown_category(client, db_factory):
    await _make_admin(client, db_factory)
    resp = await client.put("/api/v1/admin/settings", json={"default_category": "unknown_category"})
    assert resp.status_code == 400


async def test_update_demo_days(client, db_factory):
    await _make_admin(client, db_factory)
    resp = await client.put("/api/v1/admin/settings", json={"demo_days": 7})
    assert resp.status_code == 200
    assert resp.json()["demo_days"] == 7
