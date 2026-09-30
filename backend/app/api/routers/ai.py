"""
Роутер AI-агента.
POST /ai/generate-application — ставит генерацию заявки в очередь Celery.
POST /ai/applications/{id}/critique — гибридная проверка (детерминизм + строгий LLM).
POST /ai/applications/{id}/confirm-review — подтверждение проверки пользователем.
RAG-база знаний: загрузка/список/удаление личных документов пользователя.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Application, ApplicationStatus, Tender, User, KnowledgeDocument
from app.core.dependencies import get_current_user, require_active_subscription
from app.schemas.ai import (
    GenerateApplicationRequest,
    GenerateApplicationResponse,
    CritiqueRequest,
    CritiqueResponse,
    ConfirmReviewRequest,
    ConfirmReviewResponse,
    KnowledgeDocumentCreate,
    KnowledgeDocumentOut,
)

router = APIRouter()
logger = logging.getLogger("app.api.ai")


async def _get_owned_application(
    db: AsyncSession, application_id: int, user: User
) -> Application:
    """Возвращает заявку пользователя или 404. Тендер подгружаем сразу."""
    stmt = (
        select(Application)
        .where(Application.id == application_id, Application.user_id == user.id)
        .options(selectinload(Application.tender))
    )
    app = (await db.execute(stmt)).scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    return app


def _critique_response(
    app: Application,
    *,
    llm_status: Optional[str] = None,
    task_id: Optional[str] = None,
) -> CritiqueResponse:
    """Собирает ответ эндпоинта из сохранённого отчёта критика."""
    report = app.critic_report or {}
    return CritiqueResponse(
        application_id=app.id,
        status=app.status.value if hasattr(app.status, "value") else str(app.status),
        confidence=report.get("confidence", app.ai_confidence_score),
        admitted=bool(report.get("admitted", False)),
        requires_manual_review=bool(report.get("requires_manual_review", True)),
        issues=report.get("issues", []),
        not_found=report.get("not_found", []),
        hallucinated_evidence=report.get("hallucinated_evidence", []),
        grounding=report.get("grounding", {}),
        deterministic=report.get("deterministic", {}),
        disclaimer_required=bool(report.get("disclaimer_required", True)),
        checked_at=report.get("checked_at"),
        llm_status=llm_status or report.get("llm_status", "completed"),
        task_id=task_id,
    )


@router.post("/generate-application", response_model=GenerateApplicationResponse)
async def generate_application(
    payload: GenerateApplicationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
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
    current_user: User = Depends(require_active_subscription),
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


@router.post("/applications/{application_id}/critique", response_model=CritiqueResponse)
async def critique_application_endpoint(
    application_id: int,
    payload: CritiqueRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    """
    Гибридная проверка заявки.

    1) Детерминированные проверки кодом выполняются синхронно — пользователь
       получает объективные ошибки (цена, ИНН, сроки, форматы) сразу.
    2) Тяжёлый LLM-критик по «жёсткому» RAG ставится в Celery (task_id в ответе),
       чтобы не упираться в таймаут HTTP и не блокировать воркеры API.
       По завершении придёт уведомление, отчёт обновится.

    Система только подсвечивает ошибки и НЕ отправляет заявку сама.
    """
    from app.services.ai_service import run_deterministic_critique

    app = await _get_owned_application(db, application_id, current_user)
    tender = (await db.execute(select(Tender).where(Tender.id == app.tender_id))).scalar_one_or_none()
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тендер не найден")

    use_llm = True if payload is None else payload.use_llm

    # --- 1. Быстрый синхронный этап: детерминированные проверки кодом -------
    await run_deterministic_critique(
        db, tender, app, user=current_user, use_rag=False,
        llm_status="pending" if use_llm else "skipped",
    )
    await db.commit()
    await db.refresh(app)

    if not use_llm:
        return _critique_response(app, llm_status="skipped")

    # --- 2. LLM-этап в очереди ----------------------------------------------
    # Импорт локально, чтобы не тянуть Celery при импорте роутера (важно для тестов)
    try:
        from app.tasks.ai_tasks import critique_application_task

        task = critique_application_task.delay(app.id)
        return _critique_response(app, llm_status="queued", task_id=task.id)
    except Exception as exc:  # noqa: BLE001 — брокер Celery недоступен
        logger.warning("critique queue unavailable, deterministic report only: %s", exc)
        return _critique_response(app, llm_status="unavailable")


@router.post("/applications/{application_id}/confirm-review", response_model=ConfirmReviewResponse)
async def confirm_review(
    application_id: int,
    payload: ConfirmReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    """
    Подтверждение проверки пользователем (юридический дисклеймер).
    Заявка переводится в статус REVIEWED только при disclaimer_accepted=true.
    """
    if payload.disclaimer_accepted is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо подтвердить, что вы проверили данные и несёте ответственность за их корректность",
        )

    app = await _get_owned_application(db, application_id, current_user)
    if not app.critic_report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала запустите проверку ИИ-критиком",
        )
    if (app.critic_report or {}).get("llm_status") == "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ИИ-проверка ещё выполняется, дождитесь её завершения",
        )

    app.disclaimer_accepted = True
    app.review_confirmed_at = datetime.now(timezone.utc)
    app.review_confirmed_by = current_user.id
    app.review_notes = payload.notes
    app.status = ApplicationStatus.REVIEWED

    await db.commit()

    full = await _get_owned_application(db, application_id, current_user)
    return ConfirmReviewResponse(
        application=full,
        disclaimer_accepted=full.disclaimer_accepted,
        review_confirmed_at=full.review_confirmed_at,
    )
