"""
Тендерные площадки.

admin_router  — раздел админ-панели: таблица площадок, запуск скрипта парсинга
                популярных ЕТП, добавление площадки по API-адресу.
public_router — список площадок, доступных пользователю для подачи заявок.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_admin
from app.db.models import ParserConfig, User
from app.db.session import get_db
from app.schemas.platform import (
    ParseReport,
    ParseResult,
    PlatformCreate,
    PlatformCreateOut,
    PlatformOut,
    PlatformPublicOut,
    PlatformUpdate,
)
from app.services import platform_service as platforms

admin_router = APIRouter()
public_router = APIRouter()


def _out(config: ParserConfig) -> PlatformOut:
    return PlatformOut(
        id=config.id,
        platform_name=config.platform_name,
        name=platforms.display_name(config),
        url=config.url,
        api_url=config.api_url,
        is_active=config.is_active,
        status=platforms.status_of(config),
        last_run_at=config.last_run_at,
        last_error=config.last_error,
    )


async def _get_config(db: AsyncSession, platform_id: int) -> ParserConfig:
    config = (
        await db.execute(select(ParserConfig).where(ParserConfig.id == platform_id))
    ).scalar_one_or_none()
    if config is None:
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    return config


# ---------------------------------------------------------------- админ: каталог

@admin_router.get("", response_model=list[PlatformOut])
async def list_platforms(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[PlatformOut]:
    rows = (await db.execute(select(ParserConfig).order_by(ParserConfig.id.asc()))).scalars().all()
    return [_out(row) for row in rows]


@admin_router.post("", response_model=PlatformCreateOut, status_code=201)
async def create_platform(
    payload: PlatformCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> PlatformCreateOut:
    """Добавление площадки: адрес сайта обязателен, API-адрес — по желанию."""
    if not payload.url and not payload.api_url:
        raise HTTPException(
            status_code=400,
            detail="Укажите адрес сайта или API-адрес площадки",
        )

    base = platforms.make_platform_name(payload.name, payload.url, payload.api_url)
    platform_name = await platforms.unique_platform_name(db, base)

    config = ParserConfig(
        platform_name=platform_name,
        name=payload.name,
        url=payload.url,
        api_url=payload.api_url,
        api_key=payload.api_key,
        is_active=True,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)

    # Быстрая проверка API: результат показываем администратору сразу
    probe = None
    if payload.api_url:
        probe = await platforms.probe_api(payload.api_url, payload.api_key)
        if not probe["ok"]:
            config.last_error = f"API не отвечает: {probe['message']}"
            await db.commit()

    return PlatformCreateOut(platform=_out(config), probe=probe)


# --------------------------------------------- админ: запуск скрипта парсинга

@admin_router.post("/parse-popular", response_model=ParseReport)
async def run_parse_popular(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ParseReport:
    """
    Скрипт «парсинга популярных тендерных площадок»:
    добавляет 8 крупных ЕТП в каталог (если их ещё нет) и прогоняет по ним парсинг.
    После этого площадки видны в разделе «Тендерные площадки» и в ЛК пользователей.
    """
    report = await platforms.parse_popular(db)
    return ParseReport(**report)


@admin_router.post("/parse-all", response_model=ParseReport)
async def run_parse_all(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ParseReport:
    """Парсинг всех активных площадок (раздел «Парсинг»)."""
    report = await platforms.parse_all_active(db)
    return ParseReport(**report)


@admin_router.post("/{platform_id}/parse", response_model=ParseResult)
async def run_parse_platform(
    platform_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ParseResult:
    config = await _get_config(db, platform_id)
    return await platforms.run_platform_parse(db, config.platform_name)


@admin_router.patch("/{platform_id}", response_model=PlatformOut)
async def update_platform(
    platform_id: int,
    payload: PlatformUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> PlatformOut:
    config = await _get_config(db, platform_id)
    config.is_active = payload.is_active
    await db.commit()
    await db.refresh(config)
    return _out(config)


@admin_router.delete("/{platform_id}", status_code=204)
async def delete_platform(
    platform_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    config = await _get_config(db, platform_id)
    await db.delete(config)
    await db.commit()


# ------------------------------------------------- пользователь: что доступно

@public_router.get("", response_model=list[PlatformPublicOut])
async def list_available_platforms(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PlatformPublicOut]:
    """Активные площадки — доступны для подачи заявок из ЛК пользователя."""
    rows = (
        await db.execute(
            select(ParserConfig)
            .where(ParserConfig.is_active.is_(True))
            .order_by(ParserConfig.id.asc())
        )
    ).scalars().all()
    return [
        PlatformPublicOut(
            id=row.id,
            name=platforms.display_name(row),
            url=row.url or row.api_url,
            status=platforms.status_of(row),
        )
        for row in rows
    ]
