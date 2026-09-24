"""
Роутер заявок пользователя.
GET /applications — список с вложенным tender; POST/PATCH — подготовка под AI-агента.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Application, Tender, User, ApplicationStatus
from app.core.dependencies import get_current_user
from app.schemas.application import ApplicationOut, ApplicationCreate, ApplicationUpdate

router = APIRouter()


@router.get("", response_model=list[ApplicationOut])
async def list_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Application)
        .where(Application.user_id == current_user.id)
        .options(selectinload(Application.tender))
        .order_by(Application.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Создаёт черновик заявки под тендер. Дальше его заполняет AI-агент."""
    tender = (await db.execute(select(Tender).where(Tender.id == payload.tender_id))).scalar_one_or_none()
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тендер не найден")

    app = Application(user_id=current_user.id, tender_id=tender.id, status=ApplicationStatus.DRAFT)
    db.add(app)
    await db.commit()

    full = await db.execute(
        select(Application).where(Application.id == app.id).options(selectinload(Application.tender))
    )
    return full.scalar_one()


@router.patch("/{application_id}", response_model=ApplicationOut)
async def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Application)
        .where(Application.id == application_id, Application.user_id == current_user.id)
        .options(selectinload(Application.tender))
    )
    app = (await db.execute(stmt)).scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")

    if payload.status is not None:
        app.status = ApplicationStatus(payload.status)
    if payload.final_content is not None:
        app.final_content = payload.final_content
    if payload.result_price is not None:
        app.result_price = payload.result_price

    await db.commit()
    await db.refresh(app)
    return app
