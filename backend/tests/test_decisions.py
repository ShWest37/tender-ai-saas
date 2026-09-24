"""Тесты /decisions/stats: пустая сводка и расчёт по решениям пользователя."""
import pytest

from app.db.models import Application, ApplicationStatus, Tender, TenderDecision


async def test_stats_empty(auth_client):
    resp = await auth_client.get("/api/v1/decisions/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_decisions"] == 0
    assert body["average_place"] is None


async def test_stats_computation(auth_client, db_factory):
    async with db_factory() as s:
        t = Tender(title="T", status="ACTIVE")
        s.add(t)
        await s.flush()
        app = Application(user_id=1, tender_id=t.id, status=ApplicationStatus.WON)
        s.add(app)
        await s.flush()
        # Два решения по заявке: допущено (1 место) и отклонено
        s.add_all([
            TenderDecision(tender_id=t.id, application_id=app.id, is_admitted=True, place_number=1),
            TenderDecision(tender_id=t.id, application_id=app.id, is_admitted=False),
        ])
        await s.commit()

    resp = await auth_client.get("/api/v1/decisions/stats")
    body = resp.json()
    assert body["total_decisions"] == 2
    assert body["admitted_count"] == 1
    assert body["rejected_count"] == 1
    assert body["won_count"] == 1
    assert body["average_place"] == 1.0
