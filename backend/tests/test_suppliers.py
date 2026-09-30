"""
AI-поиск поставщиков: категории, поиск по ТЗ, источники прайсов, админ-настройки.
"""
from datetime import datetime, timedelta, timezone

from app.db.models import Tender, TenderStatus, User, UserRole
from app.services import price_import
from app.services.price_import import normalize_rows, parse_csv
from app.services.supplier_match import extract_tz, heuristic_match

CSV_PRICE_LIST = (
    "Наименование;Артикул;Цена с НДС;Наличие;Срок поставки\n"
    'Ноутбук Lenovo ThinkPad E14, 14", Intel Core i5;E14-G4-I5;74990;120;2\n'
    "Монитор Samsung S24R350, 24\", IPS;SAM-R350-24;12490;300;1\n"
    "Мышь беспроводная Logitech M170;LOG-M170;1190;500;1\n"
)


async def _seed_tender(db_factory, **overrides) -> int:
    payload = {
        "title": "Поставка ноутбуков для сотрудников",
        "description": (
            "Поставка 20 ноутбуков для рабочих мест.\n"
            "Процессор: Intel Core i5\n"
            "Оперативная память: 16 ГБ\n"
            "Накопитель: SSD 512 ГБ\n"
            "Гарантия: 12 месяцев"
        ),
        "platform": "Сбербанк-АСТ",
        "law_type": "44-FZ",
        "initial_price": 2_000_000,
        "region": "Москва",
        "customer_name": "ГБУ «Центр»",
        "submission_deadline": datetime.now(timezone.utc) + timedelta(days=30),
        "status": TenderStatus.ACTIVE,
    }
    payload.update(overrides)
    async with db_factory() as s:
        tender = Tender(**payload)
        s.add(tender)
        await s.commit()
        await s.refresh(tender)
        return tender.id


async def _make_admin(client, db_factory, email: str = "admin@example.com"):
    """Регистрирует пользователя и делает его администратором."""
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


# ---------------------------------------------------------------------------
# Категории
# ---------------------------------------------------------------------------
async def test_categories_default_is_it_equipment(auth_client):
    resp = await auth_client.get("/api/v1/suppliers/categories")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["default"] == "it_equipment"
    ids = [n["id"] for n in body["categories"]]
    assert "it_equipment" in ids
    # IT-оборудование — категория по умолчанию
    default = next(n for n in body["categories"] if n["id"] == "it_equipment")
    assert default["is_default"] is True
    assert default["price_source"] and default["delivery_source"]
    # Другие категории с открытыми источниками по цене и доставке
    assert len(ids) >= 5
    for category in body["categories"]:
        assert category["price_source"].get("url")
        assert category["delivery_source"].get("url")


async def test_categories_require_auth(client):
    resp = await client.get("/api/v1/suppliers/categories")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Поиск поставщиков
# ---------------------------------------------------------------------------
async def test_search_requires_auth(client):
    resp = await client.post("/api/v1/suppliers/search", json={"tender_id": 1})
    assert resp.status_code == 401


async def test_search_returns_comparison(auth_client, db_factory):
    tender_id = await _seed_tender(db_factory)

    resp = await auth_client.post(
        "/api/v1/suppliers/search",
        json={"tender_id": tender_id, "category": "it_equipment", "limit": 5, "use_llm": False},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["tender"]["id"] == tender_id
    assert body["category"] == "it_equipment"
    assert body["tz"]["specs"], "ТЗ должно содержать характеристики"
    assert body["tz"]["budget"] == 2_000_000
    assert body["results"], "Должны найтись поставщики"

    for item in body["results"]:
        comparison = item["comparison"]
        assert 0 <= comparison["match_percentage"] <= 100
        assert isinstance(comparison["matched_specs"], list)
        assert isinstance(comparison["mismatched_specs"], list)
        assert isinstance(comparison["warnings"], list)
        assert item["supplier"]
        assert item["title"]


async def test_search_blocks_when_demo_expired(auth_client, db_factory):
    tender_id = await _seed_tender(db_factory)
    async with db_factory() as s:
        from sqlalchemy import update

        await s.execute(
            update(User)
            .where(User.email == "user@example.com")
            .values(demo_expires_at=datetime.now(timezone.utc) - timedelta(days=1))
        )
        await s.commit()

    resp = await auth_client.post(
        "/api/v1/suppliers/search", json={"tender_id": tender_id, "use_llm": False}
    )
    assert resp.status_code == 402


async def test_search_with_active_subscription(auth_client, db_factory):
    tender_id = await _seed_tender(db_factory)
    async with db_factory() as s:
        from sqlalchemy import update

        await s.execute(
            update(User)
            .where(User.email == "user@example.com")
            .values(
                demo_expires_at=datetime.now(timezone.utc) - timedelta(days=1),
                subscription_plan="BUSINESS",
                subscription_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
            )
        )
        await s.commit()

    resp = await auth_client.post(
        "/api/v1/suppliers/search", json={"tender_id": tender_id, "use_llm": False}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["results"]


async def test_search_404_for_missing_tender(auth_client):
    resp = await auth_client.post(
        "/api/v1/suppliers/search", json={"tender_id": 99999, "use_llm": False}
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Источники прайсов (админ)
# ---------------------------------------------------------------------------
async def test_presets_contain_b2b_aggregators(client, db_factory):
    await _make_admin(client, db_factory)
    resp = await client.post("/api/v1/suppliers/sources/presets")
    assert resp.status_code == 200, resp.text
    slugs = {s["slug"] for s in resp.json()}
    assert {"citilink_b2b", "komus_b2b", "demo_catalog"} <= slugs


async def test_sources_require_admin(auth_client):
    resp = await auth_client.get("/api/v1/suppliers/sources")
    assert resp.status_code == 403


async def test_create_and_sync_source(client, db_factory, monkeypatch):
    await _make_admin(client, db_factory, email="admin2@example.com")

    created = await client.post(
        "/api/v1/suppliers/sources",
        json={
            "name": "Тестовый прайс",
            "supplier_name": "Тест-Поставщик",
            "source_type": "csv",
            "category": "it_equipment",
            "price_list_url": "https://example.com/price.csv",
            "default_delivery_days": 2,
        },
    )
    assert created.status_code == 201, created.text
    source = created.json()
    source_id = source["id"]

    # Подменяем скачивание прайса — в тестах не ходим в сеть
    async def fake_fetch(url: str, timeout: float = 30.0) -> bytes:
        return CSV_PRICE_LIST.encode("utf-8")

    monkeypatch.setattr(price_import, "fetch_price_list", fake_fetch)

    synced = await client.post(f"/api/v1/suppliers/sources/{source_id}/sync")
    assert synced.status_code == 200, synced.text
    result = synced.json()
    assert result["mode"] == "remote"
    assert result["imported"] == 3

    listed = await client.get("/api/v1/suppliers/sources")
    assert listed.status_code == 200
    row = next(s for s in listed.json() if s["id"] == source_id)
    assert row["offers_count"] == 3
    assert row["last_error"] is None
    assert row["category_label"]


async def test_sync_falls_back_to_demo_catalog(client, db_factory, monkeypatch):
    await _make_admin(client, db_factory, email="admin3@example.com")
    created = await client.post(
        "/api/v1/suppliers/sources",
        json={
            "name": "Недоступный прайс",
            "source_type": "csv",
            "category": "it_equipment",
            "price_list_url": "https://example.com/price.csv",
        },
    )
    assert created.status_code == 201
    source_id = created.json()["id"]

    # Прайс-лист недоступен → источник не должен «падать», а перейти в демо-каталог
    async def broken_fetch(url: str, timeout: float = 30.0) -> bytes:
        raise RuntimeError("403 Forbidden")

    monkeypatch.setattr(price_import, "fetch_price_list", broken_fetch)

    synced = await client.post(f"/api/v1/suppliers/sources/{source_id}/sync")
    assert synced.status_code == 200, synced.text
    result = synced.json()
    assert result["mode"] == "demo"
    assert result["imported"] > 0
    assert "403" in (result["error"] or "")

    listed = await client.get("/api/v1/suppliers/sources")
    row = next(s for s in listed.json() if s["id"] == source_id)
    assert row["last_error"]


# ---------------------------------------------------------------------------
# Разбор прайса
# ---------------------------------------------------------------------------
def test_parse_csv_and_normalize():
    rows = parse_csv(CSV_PRICE_LIST.encode("utf-8"))
    assert len(rows) == 3
    offers = normalize_rows(rows)
    assert len(offers) == 3
    first = offers[0]
    assert first["title"].startswith("Ноутбук Lenovo")
    assert first["price"] == 74990
    assert first["delivery_days"] == 2
    assert first["stock"] == 120
    assert first["sku"] == "E14-G4-I5"


def test_price_parsing_variants():
    assert price_import.parse_price("74 990,50 ₽") == 74990.50
    assert price_import.parse_price("1 234.56") == 1234.56
    assert price_import.parse_price("нет цены") is None
    assert price_import.parse_price(100) == 100.0


# ---------------------------------------------------------------------------
# Разбор ТЗ и детерминированные красные флаги
# ---------------------------------------------------------------------------
async def test_extract_tz_from_tender(db_factory):
    tender_id = await _seed_tender(db_factory)
    async with db_factory() as s:
        from sqlalchemy import select

        tender = (await s.execute(select(Tender).where(Tender.id == tender_id))).scalar_one()

    tz = extract_tz(tender)
    assert tz["budget"] == 2_000_000
    assert tz["quantity"] == 20
    assert tz["days_left_before_deadline"] > 0
    assert tz["specs"]["Процессор"] == "Intel Core i5"
    assert tz["specs"]["Оперативная память"] == "16 ГБ"


def test_heuristic_flags_price_and_delivery():
    tz = {
        "specs": {"Процессор": "Intel Core i5"},
        "budget": 100_000,
        "days_left_before_deadline": 5,
        "title": "Поставка ноутбуков",
        "description": "",
    }
    offer = {
        "title": "Ноутбук Lenovo ThinkPad, Intel Core i5, 16 ГБ",
        "description": "",
        "sku": "E14",
        "specs": {"Процессор": "Intel Core i5"},
        "price": 150_000,      # дороже НМЦК → красный флаг
        "delivery_days": 14,   # дольше срока подачи → красный флаг
        "stock": 0,            # нет на складе → предупреждение
    }
    result = heuristic_match(tz, offer)

    assert 0 <= result["match_percentage"] <= 100
    assert any("превышает НМЦК" in m for m in result["mismatched_specs"])
    assert any("не укладывается" in m for m in result["mismatched_specs"])
    assert any("складе" in w for w in result["warnings"])
    assert result["engine"] == "deterministic"


def test_heuristic_matches_compliant_offer():
    tz = {
        "specs": {"Процессор": "Intel Core i5", "Оперативная память": "16 ГБ"},
        "budget": 200_000,
        "days_left_before_deadline": 30,
        "title": "Поставка ноутбуков",
        "description": "",
    }
    offer = {
        "title": "Ноутбук Lenovo ThinkPad E14",
        "description": "",
        "sku": "E14",
        "specs": {"Процессор": "Intel Core i5", "Оперативная память": "16 ГБ"},
        "price": 74_990,
        "delivery_days": 2,
        "stock": 100,
    }
    result = heuristic_match(tz, offer)
    assert result["match_percentage"] >= 90
    assert not result["mismatched_specs"]
