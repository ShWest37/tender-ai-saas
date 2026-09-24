"""
Роутер поиска тендеров.
GET /tenders — список с фильтрами; GET /tenders/count — общее число под те же фильтры.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Tender, TenderStatus
from app.core.dependencies import require_active_subscription
from app.schemas.tender import TenderOut, TenderCountOut

router = APIRouter()


def _apply_filters(stmt, query: Optional[str], law_type: Optional[str], region: Optional[str]):
    """Единые фильтры, чтобы список и счётчик всегда совпадали."""
    stmt = stmt.where(Tender.status == TenderStatus.ACTIVE)
    if query:
        like = f"%{query}%"
        stmt = stmt.where(Tender.title.ilike(like))
    if law_type:
        stmt = stmt.where(Tender.law_type == law_type)
    if region:
        stmt = stmt.where(Tender.region.ilike(f"%{region}%"))
    return stmt


@router.get("", response_model=list[TenderOut])
async def list_tenders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    query: Optional[str] = None,
    law_type: Optional[str] = None,
    region: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_active_subscription),
):
    stmt = _apply_filters(select(Tender), query, law_type, region)
    stmt = stmt.order_by(Tender.submission_deadline.asc().nullslast())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/count", response_model=TenderCountOut)
async def count_tenders(
    query: Optional[str] = None,
    law_type: Optional[str] = None,
    region: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_active_subscription),
):
    stmt = _apply_filters(select(func.count(Tender.id)), query, law_type, region)
    result = await db.execute(stmt)
    return TenderCountOut(count=result.scalar_one())
