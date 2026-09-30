"""
Демо-доступ: 3 дня после регистрации, затем — только подписка.
"""
from datetime import datetime, timedelta, timezone


async def _register(client, email: str = "demo@example.com"):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Демо"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


async def _expire_demo(db_factory, email: str):
    from sqlalchemy import update

    from app.db.models import User

    async with db_factory() as s:
        await s.execute(
            update(User)
            .where(User.email == email)
            .values(demo_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))
        )
        await s.commit()


async def test_register_grants_three_days_demo(client):
    await _register(client)
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    demo_expires = datetime.fromisoformat(resp.json()["demo_expires_at"])
    if demo_expires.tzinfo is None:
        demo_expires = demo_expires.replace(tzinfo=timezone.utc)

    delta = demo_expires - datetime.now(timezone.utc)
    # DEMO_DAYS по умолчанию = 3
    assert timedelta(days=2, hours=23) < delta <= timedelta(days=3, hours=1)


async def test_expired_demo_blocks_tenders(client, db_factory):
    await _register(client)
    await _expire_demo(db_factory, "demo@example.com")

    resp = await client.get("/api/v1/tenders")
    assert resp.status_code == 402
    assert "подписк" in resp.json()["detail"].lower()


async def test_expired_demo_blocks_applications_and_ai(client, db_factory):
    await _register(client)
    await _expire_demo(db_factory, "demo@example.com")

    create_app = await client.post("/api/v1/applications", json={"tender_id": 1})
    assert create_app.status_code == 402

    knowledge = await client.post("/api/v1/ai/knowledge", json={"text": "Реквизиты"})
    assert knowledge.status_code == 402

    generate = await client.post(
        "/api/v1/ai/generate-application", json={"tender_id": 1}
    )
    assert generate.status_code == 402


async def test_expired_demo_still_allows_profile(client, db_factory):
    """После демо кабинет открывается — чтобы показать тарифы для оплаты."""
    await _register(client)
    await _expire_demo(db_factory, "demo@example.com")

    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    assert resp.json()["demo_expires_at"] is not None


async def test_subscription_unblocks_after_demo(client, db_factory):
    from sqlalchemy import update

    from app.db.models import User

    await _register(client)
    async with db_factory() as s:
        await s.execute(
            update(User)
            .where(User.email == "demo@example.com")
            .values(
                demo_expires_at=datetime.now(timezone.utc) - timedelta(days=1),
                subscription_plan="BUSINESS",
                subscription_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
            )
        )
        await s.commit()

    resp = await client.get("/api/v1/tenders")
    assert resp.status_code == 200


async def test_admin_not_blocked_after_demo(client, db_factory):
    """Администратор управляет системой и не зависит от демо-периода."""
    from sqlalchemy import update

    from app.db.models import User, UserRole

    await _register(client, email="admin_demo@example.com")
    async with db_factory() as s:
        await s.execute(
            update(User)
            .where(User.email == "admin_demo@example.com")
            .values(
                role=UserRole.ADMIN,
                demo_expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
        )
        await s.commit()

    resp = await client.get("/api/v1/tenders")
    assert resp.status_code == 200
