"""Тесты заявок: создание черновика и список с вложенным tender."""
import pytest

from app.db.models import Tender, TenderStatus


async def _make_tender(db_factory):
    async with db_factory() as s:
        t = Tender(title="Тендер для заявки", platform="ЕЭТП", status=TenderStatus.ACTIVE, initial_price=250000)
        s.add(t)
        await s.commit()
        return t.id


async def test_create_application(auth_client, db_factory):
    tender_id = await _make_tender(db_factory)
    resp = await auth_client.post("/api/v1/applications", json={"tender_id": tender_id})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "draft"
    assert body["tender_id"] == tender_id


async def test_list_applications_has_nested_tender(auth_client, db_factory):
    tender_id = await _make_tender(db_factory)
    await auth_client.post("/api/v1/applications", json={"tender_id": tender_id})

    resp = await auth_client.get("/api/v1/applications")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    # Вложенный объект tender, который рендерит страница «Мои заявки»
    assert data[0]["tender"]["title"] == "Тендер для заявки"
    assert data[0]["tender"]["platform"] == "ЕЭТП"


async def test_create_application_unknown_tender(auth_client):
    resp = await auth_client.post("/api/v1/applications", json={"tender_id": 99999})
    assert resp.status_code == 404
