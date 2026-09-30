"""
AI-поиск поставщиков с проверкой соответствия ТЗ, цене и срокам.

GET  /suppliers/categories           — каталог категорий (по умолчанию IT-оборудование);
POST /suppliers/search           — поиск поставщиков по ТЗ тендера (платный доступ);
GET  /suppliers/sources          — источники прайс-листов (админ);
POST /suppliers/sources          — добавить источник (админ);
PUT  /suppliers/sources/{id}     — изменить источник (админ);
DELETE /suppliers/sources/{id}   — удалить источник (админ);
POST /suppliers/sources/presets   — добавить пресеты B2B-агрегаторов (админ);
POST /suppliers/sources/{id}/sync — обновить прайс-лист (админ).
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_active_subscription, require_admin
from app.db.models import SupplierOffer, SupplierSource, Tender, User
from app.db.session import get_db
from app.schemas.supplier import (
    ComparisonOut,
    CategoryOut,
    CategoriesOut,
    SupplierResult,
    SupplierSearchRequest,
    SupplierSearchResponse,
    SupplierSourceCreate,
    SupplierSourceOut,
    SupplierSourceUpdate,
    SupplierSyncOut,
    TenderBrief,
)
from app.services.categories import CATEGORY_BY_ID, CATEGORIES, get_default_category, category_label
from app.services.price_import import sync_source
from app.services.supplier_catalog import (
    PRESET_SOURCES,
    ensure_demo_offers,
    ensure_preset_sources,
)
from app.services.supplier_match import (
    compare_offer,
    extract_tz,
    offer_to_row,
    relevant_offers,
)

router = APIRouter()
logger = logging.getLogger("app.api.suppliers")


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-")
    return slug or f"source-{datetime.now(timezone.utc).timestamp():.0f}"


def _source_out(source: SupplierSource) -> SupplierSourceOut:
    return SupplierSourceOut(
        id=source.id,
        slug=source.slug,
        name=source.name,
        supplier_name=source.supplier_name,
        source_type=source.source_type,
        category=source.category,
        category_label=category_label(source.category) if source.category else None,
        website=source.website,
        price_list_url=source.price_list_url,
        api_url=source.api_url,
        currency=source.currency,
        default_delivery_days=source.default_delivery_days,
        is_active=bool(source.is_active),
        offers_count=source.offers_count or 0,
        last_sync_at=source.last_sync_at,
        last_error=source.last_error,
    )


# ---------------------------------------------------------------------------
# Категории
# ---------------------------------------------------------------------------
@router.get("/categories", response_model=CategoriesOut)
async def list_categories(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Каталог категорий. По умолчанию — IT-оборудование."""
    default = await get_default_category(db)
    return CategoriesOut(
        default=default,
        categories=[
            CategoryOut(
                id=category["id"],
                label=category["label"],
                description=category.get("description", ""),
                is_default=category["id"] == default,
                price_source=category.get("price_source", {}),
                delivery_source=category.get("delivery_source", {}),
            )
            for category in CATEGORIES
        ],
    )


# ---------------------------------------------------------------------------
# Поиск поставщиков по ТЗ
# ---------------------------------------------------------------------------
@router.post("/search", response_model=SupplierSearchResponse)
async def search_suppliers(
    payload: SupplierSearchRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_active_subscription),
):
    """
    🔍 AI-поиск поставщика: берёт ТЗ тендера, подбирает позиции из
    подключённых прайс-листов и сверяет каждую с ТЗ через YandexGPT
    (match_percentage / matched_specs / mismatched_specs / warnings).
    """
    tender = (
        await db.execute(select(Tender).where(Tender.id == payload.tender_id))
    ).scalar_one_or_none()
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тендер не найден")

    # Пресеты B2B-источников создаются при первом обращении
    await ensure_preset_sources(db)

    category_id = payload.category or await get_default_category(db)
    if category_id not in CATEGORY_BY_ID:
        category_id = await get_default_category(db)

    # Если по категории ещё нет ни одного прайса — наполняем демо-каталог,
    # чтобы функция работала сразу, а не «выдавала пусто».
    seeded = await ensure_demo_offers(db, category_id)

    sources = (
        await db.execute(select(SupplierSource).where(SupplierSource.is_active.is_(True)))
    ).scalars().all()
    source_ids = [s.id for s in sources]

    offers: list[SupplierOffer] = []
    if source_ids:
        offers = (
            await db.execute(
                select(SupplierOffer).where(SupplierOffer.source_id.in_(source_ids))
            )
        ).scalars().all()

    # Категория приоритетнее: сначала позиции выбранной категории
    category_offers = [o for o in offers if o.category == category_id]
    pool = category_offers or offers

    tz = extract_tz(tender)
    keywords = CATEGORY_BY_ID[category_id].get("keywords", [])
    candidates = relevant_offers(pool, tz, keywords, limit=max(payload.limit * 2, 12))

    # Если отфильтровалось слишком мало — добираем позиции по цене
    if len(candidates) < payload.limit and pool:
        chosen = {c.id for c in candidates}
        rest = [o for o in pool if o.id not in chosen]
        rest.sort(key=lambda o: (o.price is None, o.price or 0))
        candidates.extend(rest[: payload.limit - len(candidates)])

    candidates = candidates[: payload.limit]
    await db.commit()  # фиксируем пресеты/демо-позиции до тяжёлых LLM-вызовов

    # AI-сравнение: параллельно, с гарантированным контрактом ответа
    rows = [offer_to_row(offer) for offer in candidates]
    comparisons = await asyncio.gather(
        *[compare_offer(tz, row, use_llm=payload.use_llm) for row in rows],
        return_exceptions=True,
    )

    results: list[SupplierResult] = []
    for offer, comparison in zip(candidates, comparisons):
        if isinstance(comparison, BaseException):
            logger.warning("comparison failed for offer %s: %s", offer.id, comparison)
            comparison = ComparisonOut(
                match_percentage=0.0,
                matched_specs=[],
                mismatched_specs=["Сравнение не выполнено"],
                warnings=[f"Ошибка сравнения: {comparison}"],
                engine="error",
            )
        elif isinstance(comparison, dict):
            comparison = ComparisonOut(**comparison)

        source = next((s for s in sources if s.id == offer.source_id), None)
        results.append(
            SupplierResult(
                offer_id=offer.id,
                supplier=offer.supplier_name or (source.name if source else "Поставщик"),
                source=source.name if source else "—",
                source_type=source.source_type if source else "demo",
                is_demo=bool(offer.is_demo),
                sku=offer.sku,
                title=offer.title,
                description=offer.description,
                price=offer.price,
                unit=offer.unit,
                stock=offer.stock,
                delivery_days=offer.delivery_days,
                url=offer.url,
                comparison=comparison if isinstance(comparison, ComparisonOut) else ComparisonOut(**comparison),
            )
        )

    results.sort(
        key=lambda r: (r.comparison.match_percentage, -(r.price or 0)), reverse=True
    )

    demo_catalog = bool(results) and all(
        r.is_demo or r.source_type == "demo" for r in results
    )

    return SupplierSearchResponse(
        tender=TenderBrief(
            id=tender.id,
            title=tender.title,
            platform=tender.platform,
            initial_price=tender.initial_price,
            region=tender.region,
            submission_deadline=tender.submission_deadline,
        ),
        tz=tz,
        category=category_id,
        category_label=category_label(category_id),
        results=results,
        sources_checked=len(sources),
        demo_catalog=demo_catalog or seeded,
        checked_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Источники прайс-листов (админ)
# ---------------------------------------------------------------------------
@router.get("/sources", response_model=list[SupplierSourceOut])
async def list_sources(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    await ensure_preset_sources(db)
    await db.commit()
    sources = (await db.execute(select(SupplierSource).order_by(SupplierSource.id))).scalars().all()
    return [_source_out(s) for s in sources]


@router.post("/sources", response_model=SupplierSourceOut, status_code=status.HTTP_201_CREATED)
async def create_source(
    payload: SupplierSourceCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    slug = payload.slug or _slugify(payload.name)
    exists = (
        await db.execute(select(SupplierSource).where(SupplierSource.slug == slug))
    ).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Источник уже существует")

    if payload.category and payload.category not in CATEGORY_BY_ID:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неизвестная категория")

    source = SupplierSource(
        slug=slug,
        name=payload.name,
        supplier_name=payload.supplier_name or payload.name,
        source_type=payload.source_type,
        category=payload.category,
        website=payload.website,
        price_list_url=payload.price_list_url,
        api_url=payload.api_url,
        api_key=payload.api_key,
        currency=payload.currency,
        default_delivery_days=payload.default_delivery_days,
        is_active=payload.is_active,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return _source_out(source)


@router.put("/sources/{source_id}", response_model=SupplierSourceOut)
async def update_source(
    source_id: int,
    payload: SupplierSourceUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    source = (
        await db.execute(select(SupplierSource).where(SupplierSource.id == source_id))
    ).scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Источник не найден")

    data = payload.model_dump(exclude_unset=True)
    if "category" in data and data["category"] and data["category"] not in CATEGORY_BY_ID:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неизвестная категория")

    for field, value in data.items():
        setattr(source, field, value)
    await db.commit()
    await db.refresh(source)
    return _source_out(source)


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    source = (
        await db.execute(select(SupplierSource).where(SupplierSource.id == source_id))
    ).scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Источник не найден")
    # Позиции удаляем явно: ленивая подгрузка коллекции в async-сессии ненадёжна
    await db.execute(delete(SupplierOffer).where(SupplierOffer.source_id == source_id))
    await db.delete(source)
    await db.commit()
    return None


@router.post("/sources/presets", response_model=list[SupplierSourceOut])
async def add_presets(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Добавляет пресеты крупных B2B-агрегаторов/дистрибьюторов."""
    sources = await ensure_preset_sources(db)
    await db.commit()
    return [_source_out(s) for s in sources]


@router.post("/sources/{source_id}/sync", response_model=SupplierSyncOut)
async def sync_source_endpoint(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Скачивает и разбирает прайс-лист (Excel/CSV/JSON) или наполняет демо-каталог."""
    source = (
        await db.execute(select(SupplierSource).where(SupplierSource.id == source_id))
    ).scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Источник не найден")

    try:
        result = await sync_source(db, source)
    except Exception as exc:  # noqa: BLE001
        logger.exception("source sync failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось обновить прайс-лист: {exc}",
        ) from exc
    await db.commit()
    return SupplierSyncOut(**result)
