"""
Каталоги поставщиков: пресеты B2B-агрегаторов и встроенный демо-каталог.

Пресеты — два крупных B2B-дистрибьютора, которые публикуют открытые
прайс-листы в Excel/CSV. Администратор может добавить их в один клик
и указать собственный URL прайса.

Демо-каталог — локальный набор позиций по категориям. Он используется, когда
реальный прайс-лист ещё не подключён или недоступен с сервера, чтобы
функция «AI-поиск поставщиков» была рабочей сразу после установки.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SupplierOffer, SupplierSource

# ---------------------------------------------------------------------------
# Пресеты: 1-2 крупных B2B-агрегатора / дистрибьютора с открытыми прайсами
# ---------------------------------------------------------------------------
PRESET_SOURCES: list[dict[str, Any]] = [
    {
        "slug": "citilink_b2b",
        "name": "Ситилинк (Citilink) — IT-дистрибьютор",
        "supplier_name": "Ситилинк",
        "source_type": "xlsx",
        "category": "it_equipment",
        "website": "https://www.citilink.ru/",
        "price_list_url": "https://www.citilink.ru/price/",
        "api_url": None,
        "currency": "RUB",
        "default_delivery_days": 2,
        "description": "Крупный IT-дистрибьютор: прайс-лист в Excel публикуется открыто.",
    },
    {
        "slug": "komus_b2b",
        "name": "Комус (Komus) — B2B-дистрибьютор",
        "supplier_name": "Комус",
        "source_type": "csv",
        "category": "office_supplies",
        "website": "https://www.komus.ru/",
        "price_list_url": "https://www.komus.ru/price",
        "api_url": None,
        "currency": "RUB",
        "default_delivery_days": 3,
        "description": "Один из крупнейших B2B-дистрибьюторов: офис, канцелярия, IT-периферия.",
    },
    {
        "slug": "demo_catalog",
        "name": "Встроенный демо-каталог",
        "supplier_name": "Демо-каталог",
        "source_type": "demo",
        "category": None,
        "website": None,
        "price_list_url": None,
        "api_url": None,
        "currency": "RUB",
        "default_delivery_days": 5,
        "description": "Локальный каталог позиций для демонстрации без подключения прайса.",
    },
]

# ---------------------------------------------------------------------------
# Демо-каталог по категориям
# ---------------------------------------------------------------------------
DEMO_OFFERS: dict[str, list[dict[str, Any]]] = {
    "it_equipment": [
        {
            "title": "Ноутбук Lenovo ThinkPad E14 Gen 4, 14\", Intel Core i5-1235U",
            "sku": "E14-G4-I5",
            "price": 74990,
            "delivery_days": 2,
            "stock": 120,
            "specs": {
                "Процессор": "Intel Core i5-1235U",
                "Оперативная память": "16 ГБ DDR4",
                "Накопитель": "SSD 512 ГБ",
                "Диагональ": "14 дюймов",
                "Гарантия": "12 месяцев",
            },
            "description": "Бизнес-ноутбук, корпоративная линейка, наличие на складе.",
        },
        {
            "title": "Ноутбук HP ProBook 450 G9, 15.6\", Intel Core i5-1235U",
            "sku": "PB450-G9",
            "price": 82500,
            "delivery_days": 4,
            "stock": 45,
            "specs": {
                "Процессор": "Intel Core i5-1235U",
                "Оперативная память": "16 ГБ DDR4",
                "Накопитель": "SSD 512 ГБ",
                "Диагональ": "15.6 дюйма",
                "Гарантия": "12 месяцев",
            },
            "description": "Корпоративный ноутбук, участие в гарантийной программе.",
        },
        {
            "title": "Сервер Dell PowerEdge T150, Intel Xeon E-2314, 16 ГБ, 2x1 ТБ",
            "sku": "PE-T150",
            "price": 189000,
            "delivery_days": 10,
            "stock": 8,
            "specs": {
                "Процессор": "Intel Xeon E-2314",
                "Оперативная память": "16 ГБ ECC",
                "Накопитель": "2 x 1 ТБ HDD",
                "Форм-фактор": "Tower",
                "Гарантия": "36 месяцев",
            },
            "description": "Файловый сервер для небольшой ИТ-инфраструктуры.",
        },
        {
            "title": "Монитор Samsung S24R350, 24\", IPS, 1920x1080, 75 Гц",
            "sku": "SAM-R350-24",
            "price": 12490,
            "delivery_days": 1,
            "stock": 300,
            "specs": {
                "Диагональ": "24 дюйма",
                "Матрица": "IPS",
                "Разрешение": "1920 x 1080",
                "Частота": "75 Гц",
                "Гарантия": "36 месяцев",
            },
            "description": "Офисный монитор, HDMI/VGA, рамка FreeSync.",
        },
        {
            "title": "Монитор Dell P2422H, 24\", IPS, 1920x1080, 60 Гц",
            "sku": "DELL-P2422H",
            "price": 21900,
            "delivery_days": 3,
            "stock": 90,
            "specs": {
                "Диагональ": "24 дюйма",
                "Матрица": "IPS",
                "Разрешение": "1920 x 1080",
                "Разъёмы": "HDMI, DisplayPort, USB Hub",
                "Гарантия": "36 месяцев",
            },
            "description": "Бизнес-монитор с USB-хабом и регулировкой подставки.",
        },
        {
            "title": "Принтер HP LaserJet Pro M404dn, монохром, A4, лазерный",
            "sku": "HP-M404DN",
            "price": 34900,
            "delivery_days": 2,
            "stock": 60,
            "specs": {
                "Тип печати": "Лазерный, монохром",
                "Формат": "A4",
                "Скорость": "38 стр/мин",
                "Дуплекс": "Есть",
                "Гарантия": "12 месяцев",
            },
            "description": "Сетевой офисный принтер с двусторонней печатью.",
        },
        {
            "title": "SSD Kingston NV2, 1 ТБ, M.2 NVMe PCIe 4.0",
            "sku": "KNV2-1TB",
            "price": 8990,
            "delivery_days": 1,
            "stock": 500,
            "specs": {
                "Накопитель": "SSD 1 ТБ",
                "Интерфейс": "M.2 NVMe PCIe 4.0",
                "Скорость чтения": "3500 МБ/с",
                "Гарантия": "36 месяцев",
            },
            "description": "Внутренний твердотельный накопитель.",
        },
        {
            "title": "Оперативная память Kingston Fury Beast, 16 ГБ, DDR4, 3200 МГц",
            "sku": "KF3200-16",
            "price": 4690,
            "delivery_days": 1,
            "stock": 400,
            "specs": {
                "Оперативная память": "16 ГБ",
                "Тип": "DDR4",
                "Частота": "3200 МГц",
                "Гарантия": "Пожизненная",
            },
            "description": "Модуль памяти для ПК и рабочих станций.",
        },
        {
            "title": "Сетевой коммутатор TP-Link TL-SG1024D, 24 порта, 1 Гбит/с",
            "sku": "TL-SG1024D",
            "price": 7890,
            "delivery_days": 2,
            "stock": 150,
            "specs": {
                "Порты": "24 x 1 Гбит/с",
                "Управляемый": "Нет",
                "Форм-фактор": "19\"",
                "Гарантия": "24 месяца",
            },
            "description": "Неуправляемый коммутатор уровня L2 для офиса.",
        },
        {
            "title": "Планшет Samsung Galaxy Tab A8, 10.4\", 64 ГБ, Wi-Fi",
            "sku": "TAB-A8-64",
            "price": 18990,
            "delivery_days": 5,
            "stock": 75,
            "specs": {
                "Диагональ": "10.4 дюйма",
                "Память": "64 ГБ",
                "Связь": "Wi-Fi",
                "Гарантия": "12 месяцев",
            },
            "description": "Планшет для разовых задач и полевых работ.",
        },
        {
            "title": "ИБП APC Back-UPS 1200VA, 1200 ВА, линейно-интерактивный",
            "sku": "APC-BR1200",
            "price": 16400,
            "delivery_days": 3,
            "stock": 40,
            "specs": {
                "Мощность": "1200 ВА / 720 Вт",
                "Тип": "Линейно-интерактивный",
                "Разъёмы": "6 x IEC C13",
                "Гарантия": "24 месяца",
            },
            "description": "Источник бесперебойного питания для сервера и рабочей станции.",
        },
        {
            "title": "Сканнер Эpson Perfection V39, A4, 4800 dpi",
            "sku": "EPS-V39",
            "price": 9990,
            "delivery_days": 2,
            "stock": 55,
            "specs": {
                "Формат": "A4",
                "Разрешение": "4800 dpi",
                "Тип": "Планшетный",
                "Гарантия": "12 месяцев",
            },
            "description": "Планшетный сканер для архива документов.",
        },
    ],
    "office_supplies": [
        {
            "title": "Бумага А4, 80 г/м², 500 л., пачка",
            "sku": "PAPER-80-500",
            "price": 589,
            "delivery_days": 1,
            "stock": 5000,
            "specs": {"Формат": "А4", "Плотность": "80 г/м²", "Листов": "500"},
            "description": "Белая офисная бумага для печати и ксерокса.",
        },
        {
            "title": "Картридж HP 26A (CF226A), чёрный, 3100 стр.",
            "sku": "CF226A",
            "price": 8490,
            "delivery_days": 2,
            "stock": 120,
            "specs": {"Цвет": "Чёрный", "Ресурс": "3100 страниц", "Совместимость": "HP LaserJet M507"},
            "description": "Оригинальный лазерный картридж.",
        },
        {
            "title": "Папка-регистратор 75 мм, картон, синяя",
            "sku": "REG-75-BL",
            "price": 189,
            "delivery_days": 1,
            "stock": 800,
            "specs": {"Ширина": "75 мм", "Материал": "Картон", "Цвет": "Синий"},
            "description": "Для хранения документов в архиве.",
        },
        {
            "title": "Ручка шариковая синяя, 0.7 мм, упаковка 50 шт.",
            "sku": "PEN-50",
            "price": 690,
            "delivery_days": 1,
            "stock": 1500,
            "specs": {"Цвет": "Синий", "Толщина стержня": "0.7 мм", "В упаковке": "50 шт."},
            "description": "Массовая канцелярская ручка.",
        },
    ],
    "construction": [
        {
            "title": "Цемент ЦЕМ I 42,5Н, мешок 50 кг",
            "sku": "CEM-50",
            "price": 520,
            "delivery_days": 2,
            "stock": 4000,
            "specs": {"Масса": "50 кг", "Марка": "42,5Н", "Назначение": "Общестроительный"},
            "description": "Портландцемент для бетонных и кладочных работ.",
        },
        {
            "title": "Перфоратор Bosch GBH 2-28, 820 Вт, с боковой рукояткой",
            "sku": "GBH-2-28",
            "price": 18990,
            "delivery_days": 3,
            "stock": 35,
            "specs": {"Мощность": "820 Вт", "Энергия удара": "2,7 Дж", "Гарантия": "12 месяцев"},
            "description": "Профессиональный перфоратор для бетона.",
        },
        {
            "title": "Гипсокартон ГКЛ 12,5 мм, 1200x2500 мм",
            "sku": "GKL-125",
            "price": 690,
            "delivery_days": 2,
            "stock": 900,
            "specs": {"Толщина": "12,5 мм", "Размер": "1200 x 2500 мм", "Тип": "Стандартный"},
            "description": "Лист для монтажа перегородок и подвесных потолков.",
        },
    ],
    "medical": [
        {
            "title": "Тонометр Omron M2 Basic, полуавтоматический, манжета 22-32 см",
            "sku": "OMR-M2",
            "price": 3290,
            "delivery_days": 3,
            "stock": 80,
            "specs": {"Тип": "Полуавтоматический", "Манжета": "22-32 см", "Гарантия": "24 месяца"},
            "description": "Для приёмного кабинета и разовых измерений.",
        },
        {
            "title": "Перчатки нитриловые, размер M, коробка 100 шт.",
            "sku": "GLV-M-100",
            "price": 749,
            "delivery_days": 1,
            "stock": 2000,
            "specs": {"Материал": "Нитрил", "Размер": "M", "В коробке": "100 шт."},
            "description": "Одноразовые перчатки без пудры.",
        },
        {
            "title": "Халат медицинский, хлопок, белый, размер 48-52",
            "sku": "HAL-4852",
            "price": 1290,
            "delivery_days": 4,
            "stock": 300,
            "specs": {"Материал": "Хлопок 100%", "Размер": "48-52", "Цвет": "Белый"},
            "description": "Для медицинского персонала.",
        },
    ],
    "food": [
        {
            "title": "Мука пшеничная в/с, мешок 50 кг",
            "sku": "MUKA-50",
            "price": 2350,
            "delivery_days": 2,
            "stock": 600,
            "specs": {"Масса": "50 кг", "Сорт": "Выший", "Срок годности": "6 месяцев"},
            "description": "Для пищеблоков и предприятий общественного питания.",
        },
        {
            "title": "Масло подсолнечное, 5 л, канистра",
            "sku": "MASLO-5",
            "price": 890,
            "delivery_days": 1,
            "stock": 900,
            "specs": {"Объём": "5 л", "Тип": "Рафинированное", "Срок годности": "12 месяцев"},
            "description": "Для пищеблоков и столовых.",
        },
        {
            "title": "Вода питьевая негазированная, 0,5 л, упаковка 12 шт.",
            "sku": "VODA-05-12",
            "price": 198,
            "delivery_days": 1,
            "stock": 3000,
            "specs": {"Объём": "0,5 л", "В упаковке": "12 шт.", "Газ": "Нет"},
            "description": "Для переговорных комнат и мероприятий.",
        },
    ],
    "fuel": [
        {
            "title": "Дизельное топливо (ДТ-Л-К5), литр",
            "sku": "DT-L-K5",
            "price": 74.5,
            "delivery_days": 1,
            "stock": None,
            "specs": {"Марка": "ДТ-Л-К5", "Плотность": "0,82-0,845 г/см³", "Отгрузка": "Автоцистернами"},
            "description": "Поставка на объект силами топливозаправщика.",
        },
        {
            "title": "Бензин АИ-95-К5, литр",
            "sku": "AI95-K5",
            "price": 71.2,
            "delivery_days": 1,
            "stock": None,
            "specs": {"Марка": "АИ-95-К5", "Отгрузка": "Автоцистернами", "Документы": "УПД, паспорт качества"},
            "description": "Для служебного автотранспорта.",
        },
    ],
    "furniture": [
        {
            "title": "Стол офисный 1600x800, ЛДСП 25 мм, белый",
            "sku": "STOL-1600",
            "price": 12900,
            "delivery_days": 5,
            "stock": 40,
            "specs": {"Размер": "1600 x 800 мм", "Материал": "ЛДСП", "Цвет": "Белый"},
            "description": "Для рабочего места сотрудника.",
        },
        {
            "title": "Кресло офисное сетчатое, с подголовником",
            "sku": "KRESLO-S",
            "price": 15400,
            "delivery_days": 7,
            "stock": 25,
            "specs": {"Спинка": "Сетка", "Подголовник": "Есть", "Гарантия": "24 месяца"},
            "description": "Для рабочего места с длительным сидением.",
        },
        {
            "title": "Шкаф металлический 1800x900, 4 дверцы",
            "sku": "SHKAF-4",
            "price": 18700,
            "delivery_days": 6,
            "stock": 15,
            "specs": {"Размер": "1800 x 900 мм", "Материал": "Металл", "Замок": "Сувальдный"},
            "description": "Для архива и хранения документов.",
        },
    ],
    "it_services": [
        {
            "title": "Разработка веб-приложения «под ключ», час работы",
            "sku": "DEV-HOUR",
            "price": 4500,
            "delivery_days": 5,
            "stock": None,
            "specs": {"Формат": "Помесячно", "Команда": "Аналитик, 2 разработчика, тестировщик"},
            "description": "Проектная разработка с фиксированной сметой.",
        },
        {
            "title": "Лицензия на антивирус для рабочей станции, 1 год",
            "sku": "AV-WS-1Y",
            "price": 3200,
            "delivery_days": 1,
            "stock": None,
            "specs": {"Срок": "12 месяцев", "Тип": "Корпоративная лицензия", "Установка": "Удалённо"},
            "description": "Подписка на защиту конечных устройств.",
        },
        {
            "title": "Техническая поддержка ИТ-инфраструктуры, рабочее место/мес.",
            "sku": "SUP-PC-M",
            "price": 1900,
            "delivery_days": 3,
            "stock": None,
            "specs": {"Период": "В месяц", "Реакция": "До 4 часов", "Объём": "До 50 рабочих мест"},
            "description": "Абонентское обслуживание офиса.",
        },
    ],
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_preset_sources(db: AsyncSession) -> list[SupplierSource]:
    """Создаёт пресеты источников, которых ещё нет в БД. Возвращает все источники."""
    existing = {
        s.slug: s for s in (await db.execute(select(SupplierSource))).scalars().all()
    }
    for preset in PRESET_SOURCES:
        if preset["slug"] in existing:
            continue
        db.add(
            SupplierSource(
                slug=preset["slug"],
                name=preset["name"],
                supplier_name=preset["supplier_name"],
                source_type=preset["source_type"],
                category=preset["category"],
                website=preset["website"],
                price_list_url=preset["price_list_url"],
                api_url=preset["api_url"],
                currency=preset["currency"],
                default_delivery_days=preset["default_delivery_days"],
                is_active=True,
            )
        )
    await db.flush()
    return (await db.execute(select(SupplierSource))).scalars().all()


async def ensure_demo_offers(db: AsyncSession, category_id: str) -> bool:
    """
    Гарантирует, что для категории есть хотя бы один прайс.
    Если позиций по категории нет — наполняет встроенный демо-каталог.
    Возвращает True, если были добавлены позиции.
    """
    rows = (await db.execute(select(SupplierOffer).where(SupplierOffer.category == category_id))).first()
    if rows is not None:
        return False

    demo_items = DEMO_OFFERS.get(category_id)
    if not demo_items:
        return False

    source = (
        await db.execute(select(SupplierSource).where(SupplierSource.slug == "demo_catalog"))
    ).scalar_one_or_none()
    if source is None:
        source = SupplierSource(
            slug="demo_catalog",
            name="Встроенный демо-каталог",
            supplier_name="Демо-каталог",
            source_type="demo",
            currency="RUB",
            default_delivery_days=5,
            is_active=True,
        )
        db.add(source)
        await db.flush()

    supplier_name = source.supplier_name or source.name
    for item in demo_items:
        db.add(
            SupplierOffer(
                source_id=source.id,
                supplier_name=supplier_name,
                sku=item.get("sku"),
                title=item["title"],
                description=item.get("description"),
                specs=item.get("specs") or {},
                price=item.get("price"),
                unit="шт",
                stock=item.get("stock"),
                delivery_days=item.get("delivery_days"),
                category=category_id,
                is_demo=True,
                raw_data={"demo": True},
            )
        )

    await _recalc_source_counts(db, source.id)
    source.last_sync_at = _now()
    await db.flush()
    return True


async def _recalc_source_counts(db: AsyncSession, source_id: int) -> int:
    from sqlalchemy import func

    count = (
        await db.execute(
            select(func.count(SupplierOffer.id)).where(SupplierOffer.source_id == source_id)
        )
    ).scalar_one()
    source = (
        await db.execute(select(SupplierSource).where(SupplierSource.id == source_id))
    ).scalar_one_or_none()
    if source is not None:
        source.offers_count = count
    return count


def find_offers_for_category(
    offers: list[SupplierOffer], category_id: str
) -> list[SupplierOffer]:
    """Позиции категории (запасной вариант — все позиции, если категория не проставлена)."""
    scoped = [o for o in offers if o.category == category_id]
    return scoped or offers


def source_preset(slug: str) -> Optional[dict[str, Any]]:
    for preset in PRESET_SOURCES:
        if preset["slug"] == slug:
            return preset
    return None
