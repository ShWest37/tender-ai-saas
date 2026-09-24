"""
Роутер аналитики решений площадок.
GET /decisions/stats — сводка Win/Loss по заявкам текущего пользователя.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import TenderDecision, Application, User, ApplicationStatus
from app.core.dependencies import get_current_user
from app.schemas.decision import DecisionStats

router = APIRouter()


@router.get("/stats", response_model=DecisionStats)
async def decisions_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Считаем по решениям, привязанным к заявкам пользователя.
    Победа/поражение берём из статуса заявки, допуск — из флага решения.
    """
    user_apps = select(Application.id).where(Application.user_id == current_user.id).scalar_subquery()
    base = TenderDecision.application_id.in_(user_apps)

    total = (await db.execute(select(func.count(TenderDecision.id)).where(base))).scalar_one()
    admitted = (
        await db.execute(select(func.count()).select_from(TenderDecision).where(base, TenderDecision.is_admitted.is_(True)))
    ).scalar_one()
    rejected = (
        await db.execute(select(func.count()).select_from(TenderDecision).where(base, TenderDecision.is_admitted.is_(False)))
    ).scalar_one()
    avg_place = (
        await db.execute(select(func.avg(TenderDecision.place_number)).where(base))
    ).scalar_one()

    won = (
        await db.execute(
            select(func.count(Application.id)).where(
                Application.user_id == current_user.id, Application.status == ApplicationStatus.WON
            )
        )
    ).scalar_one()
    lost = (
        await db.execute(
            select(func.count(Application.id)).where(
                Application.user_id == current_user.id, Application.status == ApplicationStatus.LOST
            )
        )
    ).scalar_one()

    return DecisionStats(
        total_decisions=total or 0,
        admitted_count=admitted or 0,
        rejected_count=rejected or 0,
        won_count=won or 0,
        lost_count=lost or 0,
        average_place=round(float(avg_place), 2) if avg_place is not None else None,
    )
