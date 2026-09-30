"""
Тесты точности AI-критика:
- детерминированные проверки (ИНН, ОКПД2, цены, сроки, отрицания);
- верификация цитат (анти-галлюцинации);
- эндпоинты проверки и подтверждения заявки.
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.db.models import Tender, TenderStatus
from app.services.deterministic_checks import (
    find_negation_sentences,
    run_deterministic_checks,
    validate_inn,
    validate_okpd2,
    verify_evidence_quotes,
)


# --------------------------------------------------------------------------- #
# Детерминированные валидаторы
# --------------------------------------------------------------------------- #
def test_validate_inn_accepts_valid_and_rejects_invalid():
    assert validate_inn("7707083893") is True       # корректная контрольная сумма
    assert validate_inn("1234567890") is False      # неверная контрольная сумма
    assert validate_inn("12345") is False           # неверная длина
    assert validate_inn("770708389a") is False      # не цифры
    assert validate_inn(None) is False


def test_validate_okpd2_format():
    assert validate_okpd2("33.12.21") is True
    assert validate_okpd2("33.12.21.000") is True
    assert validate_okpd2("abc") is False
    assert validate_okpd2("3.1") is False
    assert validate_okpd2(None) is False


def test_verify_evidence_quotes_detects_hallucination():
    source = "Заказчик требует срок поставки не более 30 календарных дней."
    # Цитата реально есть в тексте — галлюцинации нет
    assert verify_evidence_quotes(["срок поставки не более 30 календарных дней"], source) == []
    # Цитаты в тексте нет — это выдумка модели
    hallucinations = verify_evidence_quotes(["срок поставки 90 дней"], source)
    assert hallucinations == ["срок поставки 90 дней"]


def test_find_negation_sentences():
    text = "Поставка осуществляется в срок. Товар не должен иметь дефектов. Работы запрещены в выходные."
    sentences = find_negation_sentences(text)
    assert any("не должен" in s for s in sentences)
    assert any("запрещены" in s for s in sentences)


def _tender(**overrides):
    base = dict(
        title="Поставка оборудования",
        initial_price=1_000_000.0,
        law_type="44-FZ",
        okpd2_codes=["33.12.21"],
        customer_inn="7707083893",
        submission_deadline=datetime.now(timezone.utc) + timedelta(days=10),
        description="",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_deterministic_checks_pass_on_valid_application():
    report = run_deterministic_checks(
        _tender(),
        {
            "offer_price": 950_000,
            "delivery_terms": "30 дней",
            "qualification": "Опыт 5 лет",
            "warranty": "12 месяцев",
        },
        company_inn="7707083893",
    )
    assert report["is_blocking"] is False
    assert report["failed_count"] == 0
    assert report["confidence"] > 0.5


def test_deterministic_checks_block_price_over_nmck_and_expired_deadline():
    report = run_deterministic_checks(
        _tender(submission_deadline=datetime.now(timezone.utc) - timedelta(days=1)),
        {"offer_price": 2_000_000, "delivery_terms": "10 дней", "qualification": "—", "warranty": "—"},
        company_inn="7707083893",
    )
    codes = {c["code"] for c in report["failed"]}
    assert "offer_price_within_initial" in codes
    assert "submission_deadline_future" in codes
    assert report["is_blocking"] is True
    assert report["confidence"] < 0.5


def test_deterministic_checks_warn_on_unaddressed_negation():
    report = run_deterministic_checks(
        _tender(),
        {"offer_price": 900_000, "delivery_terms": "30 дней", "qualification": "опыт", "warranty": "год"},
        source_text="Товар не должен содержать вредных примесей и тяжёлых металлов.",
        company_inn="7707083893",
    )
    codes = {c["code"] for c in report["warnings"]}
    assert "negations_addressed" in codes


# --------------------------------------------------------------------------- #
# API-эндпоинты
# --------------------------------------------------------------------------- #
async def _seed_tender(db_factory, **overrides):
    async with db_factory() as s:
        tender = Tender(
            title="Тендер для AI-критика",
            platform="ЕЭТП",
            status=TenderStatus.ACTIVE,
            initial_price=1_000_000,
            law_type="44-FZ",
            customer_inn="7707083893",
            submission_deadline=datetime.now(timezone.utc) + timedelta(days=10),
            **overrides,
        )
        s.add(tender)
        await s.commit()
        return tender.id


async def _create_application(auth_client, tender_id):
    resp = await auth_client.post("/api/v1/applications", json={"tender_id": tender_id})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def test_critique_endpoint_deterministic_only(auth_client, db_factory):
    tender_id = await _seed_tender(db_factory)
    app_id = await _create_application(auth_client, tender_id)

    resp = await auth_client.post(
        f"/api/v1/ai/applications/{app_id}/critique", json={"use_llm": False}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["application_id"] == app_id
    assert body["disclaimer_required"] is True
    # Пустая заявка -> обязательные проверки не пройдены, нужна ручная проверка
    assert body["requires_manual_review"] is True
    assert body["deterministic"]["failed_count"] > 0
    # LLM отключён явно — в очередь ничего не ставится
    assert body["llm_status"] == "skipped"
    assert body["task_id"] is None


# --------------------------------------------------------------------------- #
# Асинхронный LLM-этап (Celery)
# --------------------------------------------------------------------------- #
class _FakeAsyncResult:
    id = "fake-critique-task-id"


class _FakeCritiqueTask:
    """Заглушка Celery-задачи: не обращается к брокеру."""

    @staticmethod
    def delay(*args, **kwargs):
        return _FakeAsyncResult()


class _BrokenCritiqueTask:
    """Заглушка недоступного брокера Celery."""

    @staticmethod
    def delay(*args, **kwargs):
        raise RuntimeError("broker is down")


async def test_critique_queues_llm_task(auth_client, db_factory, monkeypatch):
    import app.tasks.ai_tasks as ai_tasks

    monkeypatch.setattr(ai_tasks, "critique_application_task", _FakeCritiqueTask)

    tender_id = await _seed_tender(db_factory)
    app_id = await _create_application(auth_client, tender_id)

    resp = await auth_client.post(
        f"/api/v1/ai/applications/{app_id}/critique", json={"use_llm": True}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Детерминированная часть отдаётся сразу, LLM уходит в очередь
    assert body["llm_status"] == "queued"
    assert body["task_id"] == "fake-critique-task-id"
    assert body["deterministic"]["failed_count"] > 0
    # Пока LLM не отработал, заявку нельзя считать готовой
    assert body["requires_manual_review"] is True
    assert body["admitted"] is False


async def test_critique_returns_deterministic_report_when_broker_down(
    auth_client, db_factory, monkeypatch
):
    import app.tasks.ai_tasks as ai_tasks

    monkeypatch.setattr(ai_tasks, "critique_application_task", _BrokenCritiqueTask)

    tender_id = await _seed_tender(db_factory)
    app_id = await _create_application(auth_client, tender_id)

    resp = await auth_client.post(
        f"/api/v1/ai/applications/{app_id}/critique", json={"use_llm": True}
    )
    # Брокер недоступен — не 500, а честный детерминированный отчёт
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["llm_status"] == "unavailable"
    assert body["task_id"] is None
    assert body["deterministic"] is not None


async def test_confirm_review_blocked_while_llm_pending(auth_client, db_factory, monkeypatch):
    import app.tasks.ai_tasks as ai_tasks

    monkeypatch.setattr(ai_tasks, "critique_application_task", _FakeCritiqueTask)

    tender_id = await _seed_tender(db_factory)
    app_id = await _create_application(auth_client, tender_id)
    await auth_client.post(f"/api/v1/ai/applications/{app_id}/critique", json={"use_llm": True})

    resp = await auth_client.post(
        f"/api/v1/ai/applications/{app_id}/confirm-review",
        json={"disclaimer_accepted": True},
    )
    assert resp.status_code == 409, resp.text


async def test_critique_unknown_application_returns_404(auth_client):
    resp = await auth_client.post("/api/v1/ai/applications/99999/critique", json={"use_llm": False})
    assert resp.status_code == 404


async def test_confirm_review_requires_disclaimer(auth_client, db_factory):
    tender_id = await _seed_tender(db_factory)
    app_id = await _create_application(auth_client, tender_id)
    await auth_client.post(f"/api/v1/ai/applications/{app_id}/critique", json={"use_llm": False})

    resp = await auth_client.post(
        f"/api/v1/ai/applications/{app_id}/confirm-review",
        json={"disclaimer_accepted": False},
    )
    assert resp.status_code == 400


async def test_confirm_review_requires_critique_first(auth_client, db_factory):
    tender_id = await _seed_tender(db_factory)
    app_id = await _create_application(auth_client, tender_id)

    resp = await auth_client.post(
        f"/api/v1/ai/applications/{app_id}/confirm-review",
        json={"disclaimer_accepted": True},
    )
    assert resp.status_code == 400


async def test_confirm_review_success_sets_reviewed_status(auth_client, db_factory):
    tender_id = await _seed_tender(db_factory)
    app_id = await _create_application(auth_client, tender_id)
    await auth_client.post(f"/api/v1/ai/applications/{app_id}/critique", json={"use_llm": False})

    resp = await auth_client.post(
        f"/api/v1/ai/applications/{app_id}/confirm-review",
        json={"disclaimer_accepted": True, "notes": "Проверил вручную"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["disclaimer_accepted"] is True
    assert body["application"]["status"] == "reviewed"
    assert body["review_confirmed_at"] is not None

    # Деталь заявки содержит отчёт критика и признак подтверждения
    detail = await auth_client.get(f"/api/v1/applications/{app_id}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["disclaimer_accepted"] is True
    assert detail_body["critic_report"] is not None
    assert detail_body["deterministic_report"] is not None
