"""
Фоновые AI-задачи: генерация заявки с критикой и расчёт эмбеддингов для RAG.
"""
import logging

from sqlalchemy import select

from app.tasks.celery_app import celery_app, run_async
from app.db.session import AsyncSessionLocal
from app.db.models import Application, Tender, User, KnowledgeDocument
from app.services.ai_service import generate_application, critique_application
from app.services.notification_service import dispatch_notification

logger = logging.getLogger("app.tasks.ai")


@celery_app.task(name="app.tasks.ai_tasks.generate_application_task", bind=True, max_retries=2)
def generate_application_task(self, user_id: int, tender_id: int, application_id: int = None):
    """Генерирует заявку, прогоняет AI-критика и уведомляет пользователя."""
    async def _job():
        async with AsyncSessionLocal() as db:
            user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
            tender = (await db.execute(select(Tender).where(Tender.id == tender_id))).scalar_one_or_none()
            if user is None or tender is None:
                logger.warning("generate_application_task: user/tender not found")
                return None

            application = None
            if application_id:
                application = (
                    await db.execute(select(Application).where(Application.id == application_id))
                ).scalar_one_or_none()

            application = await generate_application(db, user, tender, application)
            application = await critique_application(db, tender, application)
            await db.commit()

            await dispatch_notification(
                db, user,
                notification_type="ai_generation_complete",
                title="AI подготовил заявку",
                body=f"Заявка по тендеру «{tender.title}» готова к проверке.",
                related_tender_id=tender.id,
                related_application_id=application.id,
                action_url=f"/dashboard/ai-agent?application_id={application.id}",
                action_label="Открыть заявку",
                email_template="notification",
            )
            return application.id

    try:
        return run_async(_job())
    except Exception as exc:  # noqa: BLE001
        logger.exception("generate_application_task failed, retrying")
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.tasks.ai_tasks.embed_document_task")
def embed_document_task(document_id: int):
    """Пересчитывает вектор документа knowledge_base через Yandex Embeddings."""
    async def _job():
        async with AsyncSessionLocal() as db:
            doc = (
                await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == document_id))
            ).scalar_one_or_none()
            if doc is None:
                return None
            from app.ai.embeddings import get_embeddings
            doc.embedding = await get_embeddings(doc.text)
            await db.commit()
            return doc.id

    return run_async(_job())
