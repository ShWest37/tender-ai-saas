"""Тесты поиска тендеров: гейт подписки, список, фильтры, счётчик."""
import pytest

from app.db.models import Tender, TenderStatus


async def _seed_tenders(db_factory, rows):
    async with db_factory() as s:
        for r in rows:
            s.add(Tender(**r))
        await s.commit()


async def test_tenders_requires_auth(client):
    resp = await client.get("/api/v1/tenders")
    assert resp.status_code == 401


async def test_list_and_count(auth_client, db_factory):
    await _seed_tenders(db_factory, [
        {"title": "Поставка серверов", "platform": "Сбербанк-АСТ", "law_type": "44-FZ",
         "initial_price": 1000000, "region": "Москва", "status": TenderStatus.ACTIVE},
        {"title": "Ремонт дороги", "platform": "РТС-тендер", "law_type": "223-FZ",
         "initial_price": 500000, "region": "Казань", "status": TenderStatus.ACTIVE},
        {"title": "Старый тендер", "platform": "Росэлторг", "law_type": "44-FZ",
         "status": TenderStatus.CLOSED},
    ])

    listing = await auth_client.get("/api/v1/tenders")
    assert listing.status_code == 200
    titles = {t["title"] for t in listing.json()}
    # CLOSED не должен попадать в выдачу
    assert titles == {"Поставка серверов", "Ремонт дороги"}

    count = await auth_client.get("/api/v1/tenders/count")
    assert count.status_code == 200
    assert count.json()["count"] == 2


async def test_filter_by_law_type(auth_client, db_factory):
    await _seed_tenders(db_factory, [
        {"title": "A", "law_type": "44-FZ", "status": TenderStatus.ACTIVE},
        {"title": "B", "law_type": "223-FZ", "status": TenderStatus.ACTIVE},
    ])
    resp = await auth_client.get("/api/v1/tenders", params={"law_type": "223-FZ"})
    data = resp.json()
    assert len(data) == 1
    assert data[0]["law_type"] == "223-FZ"


async def test_filter_by_query(auth_client, db_factory):
    await _seed_tenders(db_factory, [
        {"title": "Поставка медицинского оборудования", "status": TenderStatus.ACTIVE},
        {"title": "Уборка помещений", "status": TenderStatus.ACTIVE},
    ])
    resp = await auth_client.get("/api/v1/tenders", params={"query": "оборудован"})
    data = resp.json()
    assert len(data) == 1
    assert "оборудован" in data[0]["title"].lower()
