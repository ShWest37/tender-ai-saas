"""
Роутер AI-агента.
POST /ai/generate-application — ставит генерацию заявки в очередь Celery.
RAG-база знаний: загрузка/список/удаление личных документов пользователя.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Tender, User, KnowledgeDocument
from app.core.dependencies import get_current_user
from app.schemas.ai import (
    GenerateApplicationRequest,
    GenerateApplicationResponse,
    KnowledgeDocumentCreate,
    KnowledgeDocumentOut,
)

router = APIRouter()


@router.post("/generate-application", response_model=GenerateApplicationResponse)
async def generate_application(
    payload: GenerateApplicationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Валидируем доступ к тендеру и ставим тяжёлую LLM-генерацию в Celery.
    Синхронно отвечаем сразу — генерация занимает десятки секунд.
    """
    tender = (await db.execute(select(Tender).where(Tender.id == payload.tender_id))).scalar_one_or_none()
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тендер не найден")

    # Импорт локально, чтобы не тянуть Celery при импорте роутера (важно для тестов)
    from app.tasks.ai_tasks import generate_application_task

    try:
        task = generate_application_task.delay(current_user.id, tender.id, payload.application_id)
    except Exception as exc:  # noqa: BLE001 — брокер Celery недоступен
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Очередь задач недоступна, попробуйте позже",
        )
    return GenerateApplicationResponse(task_id=task.id)


@router.post("/knowledge", response_model=KnowledgeDocumentOut, status_code=status.HTTP_201_CREATED)
async def add_knowledge(
    payload: KnowledgeDocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Загружает текст в персональную базу знаний (RAG). Эмбеддинг считает Celery."""
    doc = KnowledgeDocument(
        user_id=current_user.id,
        text=payload.text,
        source=payload.source,
        metadata_json={},
        embedding=[0.0] * 768,  # временный вектор, перезапишется задачей embed_documents
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Расчёт эмбеддинга — в Celery; при недоступном брокере документ останется
    # с нулевым вектором и будет пересчитан повторной задачей позже.
    try:
        from app.tasks.ai_tasks import embed_document_task
        embed_document_task.delay(doc.id)
    except Exception:  # noqa: BLE001
        pass
    return doc


@router.get("/knowledge", response_model=list[KnowledgeDocumentOut])
async def list_knowledge(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(KnowledgeDocument)
        .where(KnowledgeDocument.user_id == current_user.id)
        .order_by(KnowledgeDocument.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/knowledge/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = (
        await db.execute(
            select(KnowledgeDocument).where(
                KnowledgeDocument.id == document_id, KnowledgeDocument.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден")
    await db.delete(doc)
    await db.commit()
