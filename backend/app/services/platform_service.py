"""
Сервис тендерных площадок.

- каталог популярных ЕТП (заливается скриптом «Запустить парсинг популярных площадок»);
- запуск парсинга площадки/всех активных (общая логика для API и Celery-задач);
- статусы площадок для таблицы в админ-панели;
- проверка API-адреса площадки, добавленной администратором.
"""
import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ParserConfig, Tender
from app.parsers.registry import build_parser

logger = logging.getLogger("app.services.platforms")

# Популярные ЕТП — попадают в каталог после запуска скрипта парсинга.
POPULAR_PLATFORMS: list[dict[str, str]] = [
    {"platform_name": "sberbank_ast", "name": "Сбербанк-АСТ", "url": "https://sberbank-ast.ru"},
    {"platform_name": "rts_tender", "name": "РТС-тендер", "url": "https://rts-tender.ru"},
    {"platform_name": "roseltorg", "name": "Росэлторг", "url": "https://roseltorg.ru"},
    {"platform_name": "tek_torg", "name": "ТЭК-Торг", "url": "https://tek-torg.ru"},
    {"platform_name": "gazprombank", "name": "Газпромбанк", "url": "https://gazprombank.ru"},
    {"platform_name": "nep", "name": "НЭП — Национальная электронная площадка", "url": "https://nep.ru"},
    {"platform_name": "eetp", "name": "ЕЭТП", "url": "https://eetp.ru"},
    {"platform_name": "agz_rt", "name": "АГЗ РТ — Госзаказ РТ", "url": "https://agzrt.ru"},
]

# Лимит на один запуск парсинга, чтобы запрос администратора не завис
PARSE_TIMEOUT = 15.0

# Кириллица → латиница для platform_name площадок, добавленных вручную
_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def status_of(config: ParserConfig) -> str:
    """Статус площадки для UI: active | error | pending | inactive."""
    if not config.is_active:
        return "inactive"
    if config.last_error:
        return "error"
    if config.last_run_at is None:
        return "pending"
    return "active"


def display_name(config: ParserConfig) -> str:
    """Наименование для таблицы: name заполняется админом/скриптом, fallback — slug."""
    return config.name or config.platform_name


def _translit(text: str) -> str:
    out: list[str] = []
    for ch in text.lower():
        if ch.isascii() and (ch.isalnum()):
            out.append(ch)
        elif ch.isdigit():
            out.append(ch)
        else:
            out.append(_TRANSLIT.get(ch, "_"))
    return re.sub(r"_+", "_", "".join(out)).strip("_")


def make_platform_name(name: str, url: str | None = None, api_url: str | None = None) -> str:
    """Служебное имя площадки: транслитерация названия, иначе — хост адреса."""
    base = _translit(name or "")
    if not base:
        host = urlparse(url or api_url or "").hostname or ""
        base = re.sub(r"[^a-z0-9]+", "_", host.lower()).strip("_")
    return base or "platform"


async def unique_platform_name(db: AsyncSession, base: str) -> str:
    """base, base_2, base_3… — пока имя не станет свободным."""
    candidate = base
    suffix = 2
    while (
        await db.execute(select(ParserConfig).where(ParserConfig.platform_name == candidate))
    ).scalar_one_or_none() is not None:
        candidate = f"{base}_{suffix}"
        suffix += 1
    return candidate


async def upsert_popular_platforms(db: AsyncSession) -> tuple[list[ParserConfig], int]:
    """
    Гарантирует наличие популярных площадок в каталоге.
    Возвращает (список конфигов, сколько добавлено новых).
    """
    configs: list[ParserConfig] = []
    created = 0
    for item in POPULAR_PLATFORMS:
        config = (
            await db.execute(
                select(ParserConfig).where(ParserConfig.platform_name == item["platform_name"])
            )
        ).scalar_one_or_none()
        if config is None:
            config = ParserConfig(
                platform_name=item["platform_name"],
                name=item["name"],
                url=item["url"],
                is_active=True,
            )
            db.add(config)
            created += 1
        else:
            # Дозаполняем поля для строк, созданных раньше
            config.name = config.name or item["name"]
            config.url = config.url or item["url"]
        configs.append(config)
    await db.commit()
    return configs, created


async def run_platform_parse(
    db: AsyncSession, platform_name: str, *, timeout: float = PARSE_TIMEOUT
) -> dict[str, Any]:
    """
    Парсит одну площадку в переданной сессии и обновляет её конфиг.
    Возвращает результат в форме, которую понимает раздел «Парсинг»:
    {platform, platform_name, status, tenders_found, created, message}.
    """
    config = (
        await db.execute(select(ParserConfig).where(ParserConfig.platform_name == platform_name))
    ).scalar_one_or_none()
    title = display_name(config) if config else platform_name

    parser = build_parser(
        platform_name,
        api_url=config.api_url if config else None,
        api_key=config.api_key if config else None,
    )
    if parser is None:
        # У площадки нет адаптера: проверяем, что хотя бы сайт отвечает —
        # так строка в админ-панели получает честный статус без ложной ошибки.
        message = "Площадка не подключена: укажите адрес сайта или API-адрес"
        ok = False
        site = config.url if config else None
        if site:
            probe = await probe_api(site, timeout=8.0)
            ok = probe["ok"]
            message = (
                "Площадка проверена: сайт отвечает. Для загрузки тендеров укажите API-адрес."
                if ok
                else f"Сайт не отвечает: {probe['message']}"
            )
        logger.warning("Парсер для %s не найден", platform_name)
        if config is not None:
            config.last_run_at = datetime.now(timezone.utc)
            config.last_error = None if ok else message
            await db.commit()
        return {
            "platform": title,
            "platform_name": platform_name,
            "status": "success" if ok else "error",
            "tenders_found": 0,
            "created": 0,
            "message": message,
        }

    try:
        raw_items: list[dict[str, Any]] = await asyncio.wait_for(parser.fetch_raw(), timeout=timeout)
        created = 0
        for raw in raw_items:
            normalized = parser.normalize(raw)
            if not normalized:
                continue
            existing = (
                await db.execute(
                    select(Tender).where(Tender.external_id == normalized["external_id"])
                )
            ).scalar_one_or_none()
            if existing is None:
                db.add(Tender(**normalized))
                created += 1

        if config is not None:
            config.last_run_at = datetime.now(timezone.utc)
            config.last_error = None
        await db.commit()

        message = (
            f"Парсинг завершён: получено {len(raw_items)}, новых {created}"
            if raw_items
            else "Парсинг завершён: площадка не вернула данных"
        )
        logger.info("Площадка %s: fetched=%s created=%s", platform_name, len(raw_items), created)
        return {
            "platform": title,
            "platform_name": platform_name,
            "status": "success",
            "tenders_found": len(raw_items),
            "created": created,
            "message": message,
        }

    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        message = str(exc)[:500] or "Ошибка парсинга"
        if config is not None:
            config.last_run_at = datetime.now(timezone.utc)
            config.last_error = message
            await db.commit()
        logger.exception("Площадка %s: ошибка парсинга", platform_name)
        return {
            "platform": title,
            "platform_name": platform_name,
            "status": "error",
            "tenders_found": 0,
            "created": 0,
            "message": message,
        }


async def parse_popular(db: AsyncSession) -> dict[str, Any]:
    """Скрипт: добавляет популярные площадки в каталог и прогоняет парсинг по ним."""
    configs, created = await upsert_popular_platforms(db)
    results = [
        await run_platform_parse(db, config.platform_name) for config in configs
    ]
    return {
        "results": results,
        "created": created,
        "total": len(results),
        "success": sum(1 for r in results if r["status"] == "success"),
    }


async def parse_all_active(db: AsyncSession) -> dict[str, Any]:
    """Парсинг всех активных площадок каталога."""
    rows = (
        await db.execute(select(ParserConfig).where(ParserConfig.is_active.is_(True)))
    ).scalars().all()
    results = [await run_platform_parse(db, row.platform_name) for row in rows]
    return {
        "results": results,
        "total": len(results),
        "success": sum(1 for r in results if r["status"] == "success"),
    }


async def probe_api(api_url: str, api_key: str | None = None, timeout: float = 8.0) -> dict[str, Any]:
    """
    Быстрая проверка API-адреса площадки при добавлении администратором.
    {ok: bool, message: str} — ok=True только при HTTP < 400.
    """
    headers = {"Accept": "application/json", "User-Agent": "BidFlow/1.0 (+api)"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        headers["X-API-Key"] = api_key
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(api_url, headers=headers)
        ok = resp.status_code < 400
        return {"ok": ok, "message": f"HTTP {resp.status_code}"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "message": str(exc)[:200] or "API недоступен"}
