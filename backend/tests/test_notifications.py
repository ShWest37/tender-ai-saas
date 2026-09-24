"""Тесты in-app уведомлений и настроек каналов."""
import pytest
from datetime import datetime, timezone

from app.db.models import InAppNotification


async def _seed_notifications(db_factory):
    async with db_factory() as s:
        s.add_all([
            InAppNotification(user_id=1, notification_type="new_tender_found",
                              title="Новый тендер", body="Найден тендер", is_read=False),
            InAppNotification(user_id=1, notification_type="payment_success",
                              title="Оплата", body="Оплата прошла", is_read=True),
        ])
        await s.commit()


async def test_list_in_app(auth_client, db_factory):
    await _seed_notifications(db_factory)
    resp = await auth_client.get("/api/v1/notifications")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_unread_count(auth_client, db_factory):
    await _seed_notifications(db_factory)
    resp = await auth_client.get("/api/v1/notifications/unread-count")
    assert resp.json()["unread_count"] == 1


async def test_mark_read(auth_client, db_factory):
    await _seed_notifications(db_factory)
    # id=1 — непрочитанное
    resp = await auth_client.post("/api/v1/notifications/1/read")
    assert resp.status_code == 204
    count = await auth_client.get("/api/v1/notifications/unread-count")
    assert count.json()["unread_count"] == 0


async def test_preferences_defaults(auth_client):
    resp = await auth_client.get("/api/v1/notifications/preferences")
    assert resp.status_code == 200
    body = resp.json()
    # По умолчанию: email вкл, MAX выкл (см. models.py)
    assert body["email_enabled"] is True
    assert body["max_enabled"] is False


async def test_update_preferences(auth_client):
    resp = await auth_client.put(
        "/api/v1/notifications/preferences",
        json={"max_enabled": True, "max_chat_id": "chat-42"},
    )
    assert resp.status_code == 200
    assert resp.json()["max_enabled"] is True
    assert resp.json()["max_chat_id"] == "chat-42"
