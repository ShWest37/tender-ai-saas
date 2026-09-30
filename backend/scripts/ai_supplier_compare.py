"""
AI-сравнение ТЗ тендера со строкой прайса поставщика (YandexGPT).

Скрипт берёт ТЗ тендера (JSON после парсинга) и строку прайса поставщика,
отправляет их в YandexGPT с промптом

    «Сравни требования ТЗ и предложение поставщика.
      Верни JSON с полями: match_percentage, matched_specs, mismatched_specs, warnings»

и печатает результат в stdout.

Примеры запуска (из каталога backend):

    # 1) Без БД: готовые JSON-файлы
    python scripts/ai_supplier_compare.py --tz tz.json --offer offer.json

    # 2) Из базы: ТЗ берётся из тендера, предложение — из файла прайса
    python scripts/ai_supplier_compare.py --tender-id 123 --offer offer.json

    # 3) Быстрая демонстрация на встроенном примере
    python scripts/ai_supplier_compare.py --demo

    # 4) Только детерминированные проверки (без вызова LLM)
    python scripts/ai_supplier_compare.py --demo --no-llm
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Windows-консоль (cp1251) не умеет печатать ₽ и кириллицу из ответа LLM
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (ValueError, OSError):  # pragma: no cover — поток закрыт/перенаправлен
        pass

# --------------------------------------------------------------------------- #
# Демо-примеры
# --------------------------------------------------------------------------- #
DEMO_TZ = {
    "tender_id": 0,
    "title": "Поставка ноутбуков для сотрудников",
    "description": "Поставка 20 ноутбуков для рабочих мест",
    "customer": "ГБУ «Центр»",
    "region": "Москва",
    "law_type": "44-FZ",
    "budget": 2_000_000,
    "quantity": 20,
    "deadline": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    "days_left_before_deadline": 30,
    "specs": {
        "Процессор": "Intel Core i5",
        "Оперативная память": "16 ГБ",
        "Накопитель": "SSD 512 ГБ",
        "Гарантия": "12 месяцев",
    },
}

DEMO_OFFER = {
    "supplier": "Ситилинк",
    "sku": "E14-G4-I5",
    "title": "Ноутбук Lenovo ThinkPad E14 Gen 4, 14\", Intel Core i5-1235U",
    "description": "Бизнес-ноутбук, корпоративная линейка, наличие на складе.",
    "specs": {
        "Процессор": "Intel Core i5-1235U",
        "Оперативная память": "16 ГБ DDR4",
        "Накопитель": "SSD 512 ГБ",
        "Диагональ": "14 дюймов",
        "Гарантия": "12 месяцев",
    },
    "price": 74_990,
    "currency": "RUB",
    "unit": "шт",
    "stock": 120,
    "delivery_days": 2,
    "url": None,
}


def _load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise SystemExit(f"Ожидался JSON-объект: {path}")
    return data


async def _load_tz_from_db(tender_id: int) -> dict:
    """ТЗ тендера собирается из БД так же, как в /suppliers/search."""
    from sqlalchemy import select

    from app.db.models import Tender
    from app.db.session import AsyncSessionLocal
    from app.services.supplier_match import extract_tz

    async with AsyncSessionLocal() as session:
        tender = (
            await session.execute(select(Tender).where(Tender.id == tender_id))
        ).scalar_one_or_none()
        if tender is None:
            raise SystemExit(f"Тендер id={tender_id} не найден")
        return extract_tz(tender)


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="AI-сравнение ТЗ тендера и строки прайса поставщика"
    )
    parser.add_argument("--tz", help="Путь к JSON с ТЗ тендера")
    parser.add_argument("--tender-id", type=int, help="ID тендера в БД (ТЗ извлекается автоматически)")
    parser.add_argument("--offer", help="Путь к JSON со строкой прайса поставщика")
    parser.add_argument("--demo", action="store_true", help="Использовать встроенный пример")
    parser.add_argument("--no-llm", action="store_true", help="Без вызова LLM (детерминированные проверки)")
    parser.add_argument("--pretty", action="store_true", default=True, help="Красивый вывод (по умолчанию)")
    parser.add_argument("--compact", action="store_true", help="Компактный вывод одной строкой")
    args = parser.parse_args()

    from app.services.supplier_match import compare_offer

    # --- ТЗ ---------------------------------------------------------------
    if args.demo:
        tz = DEMO_TZ
    elif args.tender_id:
        tz = await _load_tz_from_db(args.tender_id)
    elif args.tz:
        tz = _load_json(args.tz)
    else:
        parser.error("Укажите --tz, --tender-id или --demo")
        return 2

    # --- Поставщик ---------------------------------------------------------
    if args.demo:
        offer = DEMO_OFFER
    elif args.offer:
        offer = _load_json(args.offer)
    else:
        parser.error("Укажите --offer или --demo")
        return 2

    # --- Сравнение ---------------------------------------------------------
    result = await compare_offer(tz, offer, use_llm=not args.no_llm)

    payload = {
        "tz_title": tz.get("title"),
        "supplier": offer.get("supplier"),
        "offer_title": offer.get("title"),
        "price": offer.get("price"),
        "delivery_days": offer.get("delivery_days"),
        **result,
    }
    indent = None if args.compact else 2
    print(json.dumps(payload, ensure_ascii=False, indent=indent))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
