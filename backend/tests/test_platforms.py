"""
Тендерные площадки: админ-каталог, скрипт парсинга популярных ЕТП,
добавление по API-адресу и список для ЛК пользователя.
"""
from sqlalchemy import update

from app.db.models import User, UserRole
from app.services.platform_service import POPULAR_PLATFORMS


async def _make_admin(client, db_factory, email: str = "boss@example.com"):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Босс"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    async with db_factory() as s:
        await s.execute(update(User).where(User.email == email).values(role=UserRole.ADMIN))
        await s.commit()
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


async def test_admin_platforms_requires_admin(auth_client):
    """Обычный пользователь не имеет доступа к админ-разделу площадок."""
    resp = await auth_client.get("/api/v1/admin/platforms")
    assert resp.status_code == 403

    resp = await auth_client.post("/api/v1/admin/platforms/parse-popular")
    assert resp.status_code == 403


async def test_admin_platforms_requires_auth(client):
    resp = await client.get("/api/v1/admin/platforms")
    assert resp.status_code == 401


async def test_parse_popular_creates_catalog(client, db_factory):
    """Скрипт парсинга популярных площадок наполняет каталог зелёными строками."""
    await _make_admin(client, db_factory)

    resp = await client.post("/api/v1/admin/platforms/parse-popular")
    assert resp.status_code == 200, resp.text
    report = resp.json()
    assert report["total"] == len(POPULAR_PLATFORMS)
    assert report["created"] == len(POPULAR_PLATFORMS)
    assert report["success"] == len(POPULAR_PLATFORMS)
    assert all(r["status"] == "success" for r in report["results"])

    # Каталог: наименование, адрес сайта и статус у каждой площадки
    resp = await client.get("/api/v1/admin/platforms")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == len(POPULAR_PLATFORMS)
    for row in rows:
        assert row["name"], "у площадки есть наименование"
        assert row["url"].startswith("https://"), "есть адрес сайта"
        assert row["status"] == "active"
        assert row["last_run_at"], "скрипт зафиксировал запуск"

    # Повторный запуск не дублирует строки
    resp = await client.post("/api/v1/admin/platforms/parse-popular")
    assert resp.json()["created"] == 0
    assert (await client.get("/api/v1/admin/platforms")).json().__len__() == len(POPULAR_PLATFORMS)


async def test_platforms_appear_in_user_cabinet(client, db_factory):
    """После добавления админом площадки видны пользователю в ЛК."""
    await _make_admin(client, db_factory)
    await client.post("/api/v1/admin/platforms/parse-popular")

    # Выключаем одну площадку админом (токен админа сохраняем)
    admin_auth = client.headers["Authorization"]
    admin_rows = (await client.get("/api/v1/admin/platforms")).json()
    target = next(r for r in admin_rows if r["name"] == "Сбербанк-АСТ")
    resp = await client.patch(
        f"/api/v1/admin/platforms/{target['id']}", json={"is_active": False}
    )
    assert resp.status_code == 200 and resp.json()["is_active"] is False

    # «Чистый» пользователь видит только активные площадки
    user = await client.post(
        "/api/v1/auth/register",
        json={"email": "viewer@example.com", "password": "password123", "full_name": "Зритель"},
    )
    assert user.status_code == 201, user.text
    client.headers.update({"Authorization": f"Bearer {user.json()['access_token']}"})

    resp = await client.get("/api/v1/platforms")
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert len(rows) == len(POPULAR_PLATFORMS) - 1
    names = {r["name"] for r in rows}
    assert "Сбербанк-АСТ" not in names, "выключенная площадка скрыта из ЛК"
    assert "РТС-тендер" in names and "Росэлторг" in names
    assert all(r["url"] for r in rows)

    # Но в админ-таблице строка осталась
    client.headers.update({"Authorization": admin_auth})
    admin_names = {r["name"] for r in (await client.get("/api/v1/admin/platforms")).json()}
    assert "Сбербанк-АСТ" in admin_names


async def test_add_platform_by_api_address(client, db_factory):
    """Добавление площадки по API-адресу: строка появляется, API проверяется."""
    await _make_admin(client, db_factory)

    resp = await client.post(
        "/api/v1/admin/platforms",
        json={
            "name": "Моя площадка",
            "url": "https://example.org",
            "api_url": "https://127.0.0.1:1/api/tenders",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    platform = body["platform"]
    assert platform["name"] == "Моя площадка"
    assert platform["platform_name"], "служебное имя сгенерировано"
    assert platform["api_url"].endswith("/api/tenders")
    # Недоступный API честно отмечается ошибкой (порт 1 не слушает)
    assert body["probe"]["ok"] is False
    assert platform["status"] == "error"

    rows = (await client.get("/api/v1/admin/platforms")).json()
    assert any(r["name"] == "Моя площадка" for r in rows)


async def test_add_platform_requires_address(client, db_factory):
    await _make_admin(client, db_factory)
    resp = await client.post("/api/v1/admin/platforms", json={"name": "Без адреса"})
    assert resp.status_code == 400

    # Некорректная схема отклоняется
    resp = await client.post(
        "/api/v1/admin/platforms",
        json={"name": "Плохой адрес", "url": "ftp://example.org"},
    )
    assert resp.status_code == 422


async def test_delete_platform(client, db_factory):
    await _make_admin(client, db_factory)
    await client.post("/api/v1/admin/platforms/parse-popular")
    rows = (await client.get("/api/v1/admin/platforms")).json()

    resp = await client.delete(f"/api/v1/admin/platforms/{rows[0]['id']}")
    assert resp.status_code == 204
    rest = (await client.get("/api/v1/admin/platforms")).json()
    assert len(rest) == len(rows) - 1

    resp = await client.delete("/api/v1/admin/platforms/999999")
    assert resp.status_code == 404


async def test_parse_single_platform(client, db_factory):
    await _make_admin(client, db_factory)
    await client.post("/api/v1/admin/platforms/parse-popular")
    rows = (await client.get("/api/v1/admin/platforms")).json()
    target = rows[0]

    resp = await client.post(f"/api/v1/admin/platforms/{target['id']}/parse")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["platform"] == target["name"]
    assert body["status"] in ("success", "error")
