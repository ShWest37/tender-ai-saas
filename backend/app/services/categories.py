"""
Каталог категорий закупок для AI-поиска поставщиков.

Категория — это рынок, на котором мы ищем поставщика по ТЗ тендера.
По умолчанию выбрана категория IT-оборудования: самый частый и самый
структурированный тип закупок (компьютеры, серверы, периферия) —
у него же открытые источники по цене и срокам доставки.

В каждой категории указаны открытые источники:
- price_source   — открытый прайс-лист / каталог (Excel/CSV/JSON);
- delivery_source — источник данных о сроках доставки.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AppSetting

DEFAULT_CATEGORY = "it_equipment"
DEFAULT_CATEGORY_SETTING_KEY = "default_category"

CATEGORIES: list[dict[str, Any]] = [
    {
        "id": "it_equipment",
        "label": "IT-оборудование (компьютеры, серверы, периферия)",
        "description": "Компьютеры, серверы, СХД, мониторы, периферия, сетевое оборудование.",
        "keywords": [
            "ноутбук", "компьютер", "сервер", "монитор", "принтер", "сканер",
            "клавиатура", "мышь", "ssd", "hdd", "накопитель", "оперативн", "память",
            "процессор", "видеокарт", "роутер", "коммутатор", "свитч", "ip-камера",
            "перифер", "планшет", "дисплей", "материнск", "блок питания", "кулер",
        ],
        "price_source": {
            "name": "Открытые прайс-листы IT-дистрибьюторов (Citilink, DNS, Комус)",
            "url": "https://www.citilink.ru/price/",
        },
        "delivery_source": {
            "name": "Сроки доставки из прайса дистрибьютора (поле «Срок поставки»)",
            "url": "https://www.citilink.ru/price/",
        },
    },
    {
        "id": "office_supplies",
        "label": "Канцелярские и офисные товары",
        "description": "Канцелярия, бумага, тонеры, расходные материалы для офиса.",
        "keywords": [
            "канцеляр", "бумага", "папка", "ручк", "тонер", "картридж", "степлер",
            "офис", "блокнот", "маркер", "конверт", "стикер",
        ],
        "price_source": {
            "name": "Открытый прайс-лист B2B-дистрибьютора «Комус» (Excel/CSV)",
            "url": "https://www.komus.ru/price",
        },
        "delivery_source": {
            "name": "Условия и сроки доставки «Комус» по регионам",
            "url": "https://www.komus.ru/info/delivery",
        },
    },
    {
        "id": "construction",
        "label": "Строительные материалы и оборудование",
        "description": "Лес, крепёж, инструмент, отделочные и строительные материалы.",
        "keywords": [
            "строитель", "цемент", "бетон", "арматур", "инструмент", "перфоратор",
            "дрель", "смеситель", "утеплит", "гипсокартон", "краск", "лак",
        ],
        "price_source": {
            "name": "Открытые прайс-листы строительных сетей (Петрович, Лемана ПРО)",
            "url": "https://petrovich.ru/price/",
        },
        "delivery_source": {
            "name": "Тарифы и сроки доставки строительных сетей",
            "url": "https://petrovich.ru/delivery/",
        },
    },
    {
        "id": "medical",
        "label": "Медицинское оборудование и расходники",
        "description": "Медтехника, расходные материалы, мебель и расходники для клиник.",
        "keywords": [
            "медицин", "халат", "перчат", "шприц", "бинт", "стерил", "тонометр",
            "стетоскоп", "кабинет", "реанимац", "диагност",
        ],
        "price_source": {
            "name": "Открытые прайс-листы меддистрибьюторов (Оптисал, Медэкс)",
            "url": "https://www.medical-union.ru/price/",
        },
        "delivery_source": {
            "name": "Сроки поставки медоборудования (условия дистрибьюторов)",
            "url": "https://www.medical-union.ru/delivery/",
        },
    },
    {
        "id": "food",
        "label": "Продукты питания и напитки",
        "description": "Питание для учреждений, бакалея, напитки, пищевое сырьё.",
        "keywords": [
            "продукт", "питани", "бакале", "мясо", "молоч", "хлеб", "овощ",
            "напит", "сок", "вода", "каша", "масло",
        ],
        "price_source": {
            "name": "Открытые прайс-листы оптовых поставщиков продовольствия",
            "url": "https://metizagro.ru/price/",
        },
        "delivery_source": {
            "name": "Сроки и температурный режим доставки продовольствия",
            "url": "https://metizagro.ru/delivery/",
        },
    },
    {
        "id": "fuel",
        "label": "ГСМ и топливо",
        "description": "Бензин, дизельное топливо, смазочные материалы.",
        "keywords": [
            "топлив", "бензин", "дизел", "дт", "масл", "смазочн", "гсм", "камаз",
        ],
        "price_source": {
            "name": "Открытые биржевые котировки и прайсы нефтетрейдеров",
            "url": "https://www.surgutneftegas.ru/prices/",
        },
        "delivery_source": {
            "name": "Условия отгрузки и доставки топлива",
            "url": "https://www.surgutneftegas.ru/delivery/",
        },
    },
    {
        "id": "furniture",
        "label": "Мебель и обстановка",
        "description": "Офисная и школьная мебель, оснащение помещений.",
        "keywords": [
            "мебель", "стол", "стул", "шкаф", "кресло", "кровать", "стойка",
            "оснащен", "интерьер",
        ],
        "price_source": {
            "name": "Открытые прайс-листы мебельных производителей",
            "url": "https://www.leroymerlin.ru/price/",
        },
        "delivery_source": {
            "name": "Сроки доставки мебели и оснащения",
            "url": "https://www.leroymerlin.ru/price/",
        },
    },
    {
        "id": "it_services",
        "label": "IT-услуги и программное обеспечение",
        "description": "Разработка, лицензии, обслуживание, облачные сервисы.",
        "keywords": [
            "разработ", "программн", "лицензи", "облач", "поддержк", "внедрен",
            "сопровожд", "saas", "информационн",
        ],
        "price_source": {
            "name": "Открытые прайс-листы интеграторов и вендоров ПО",
            "url": "https://www.croc.ru/price/",
        },
        "delivery_source": {
            "name": "Сроки внедрения и оказания IT-услуг",
            "url": "https://www.croc.ru/services/",
        },
    },
]

CATEGORY_BY_ID: dict[str, dict[str, Any]] = {c["id"]: c for c in CATEGORIES}


def category_ids() -> list[str]:
    return [c["id"] for c in CATEGORIES]


def category_label(category_id: Optional[str]) -> str:
    """Человекочитаемое название категории (или «Не выбрана»)."""
    if not category_id:
        return "Не выбрана"
    category = CATEGORY_BY_ID.get(category_id)
    return category["label"] if category else category_id


def get_category(category_id: Optional[str]) -> Optional[dict[str, Any]]:
    """Категория по id; неизвестный id → None (вызывающий подставит дефолт)."""
    if not category_id:
        return None
    return CATEGORY_BY_ID.get(category_id)


async def get_default_category(db: AsyncSession) -> str:
    """
    Категория по умолчанию для админ-панели и поиска.
    Если настройка не сохранена — IT-оборудование.
    """
    row = (
        await db.execute(select(AppSetting).where(AppSetting.key == DEFAULT_CATEGORY_SETTING_KEY))
    ).scalar_one_or_none()
    if row is None or not row.value_json:
        return DEFAULT_CATEGORY
    value = row.value_json if isinstance(row.value_json, str) else row.value_json.get("value")
    return value if value in CATEGORY_BY_ID else DEFAULT_CATEGORY


async def set_default_category(db: AsyncSession, category_id: str) -> str:
    """Сохраняет категорию по умолчанию (возвращает фактически записанное значение)."""
    value = category_id if category_id in CATEGORY_BY_ID else DEFAULT_CATEGORY
    row = (
        await db.execute(select(AppSetting).where(AppSetting.key == DEFAULT_CATEGORY_SETTING_KEY))
    ).scalar_one_or_none()
    if row is None:
        db.add(AppSetting(key=DEFAULT_CATEGORY_SETTING_KEY, value_json=value))
    else:
        row.value_json = value
    await db.flush()
    return value
