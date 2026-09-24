"""Тесты авторизации: регистрация, вход, профиль, доступ к /me."""
import pytest


async def test_register_returns_tokens(client):
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "new@example.com",
            "password": "secret12345",
            "full_name": "Новый Пользователь",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert "access_token" in body and "refresh_token" in body


async def test_register_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "secret12345", "full_name": "Дубль"}
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 409


async def test_login_wrong_password(client):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "a@example.com", "password": "secret12345", "full_name": "A"},
    )
    resp = await client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "WRONG"})
    assert resp.status_code == 401


async def test_login_ok(client):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "b@example.com", "password": "secret12345", "full_name": "B"},
    )
    resp = await client.post("/api/v1/auth/login", json={"email": "b@example.com", "password": "secret12345"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_me_requires_auth(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_me_returns_subscription_fields(auth_client):
    resp = await auth_client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "user@example.com"
    # Поля, которые читает billing-страница
    for field in ("subscription_plan", "subscription_expires_at", "demo_expires_at"):
        assert field in body
    # Демо-период выставлен при регистрации
    assert body["demo_expires_at"] is not None


async def test_update_profile(auth_client):
    resp = await auth_client.put(
        "/api/v1/auth/profile",
        json={"full_name": "Обновлённое Имя", "company_name": "ООО Обновлено", "inn": "9876543210"},
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Обновлённое Имя"
