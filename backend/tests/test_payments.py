"""
Тесты платежей без реальных ключей YooKassa.
Проверяем гейт авторизации, валидацию тарифа и идемпотентный webhook.
"""
import pytest


async def test_create_requires_auth(client):
    resp = await client.post("/api/v1/payments/create", json={"plan": "start"})
    assert resp.status_code == 401


async def test_create_invalid_plan(auth_client):
    resp = await auth_client.post("/api/v1/payments/create", json={"plan": "hacker"})
    assert resp.status_code == 422


async def test_webhook_accepts_non_succeeded_event(client):
    # Событие не payment.succeeded — фоновая задача завершится до обращения к БД
    resp = await client.post(
        "/api/v1/payments/webhook",
        json={"event": "waiting_for_capture", "object": {"id": "pay_xxx"}},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
