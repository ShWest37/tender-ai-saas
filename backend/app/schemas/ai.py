"""
Схемы AI-агента: генерация заявки, критика, загрузка документов в базу знаний.
"""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.application import ApplicationOut


class GenerateApplicationRequest(BaseModel):
    """POST /ai/generate-application — запуск генерации заявки по тендеру."""
    tender_id: int
    # Если задан — переиспользуем существующую заявку (draft), иначе создаём новую
    application_id: Optional[int] = None


class GenerateApplicationResponse(BaseModel):
    task_id: str
    status: str = "queued"


class KnowledgeDocumentCreate(BaseModel):
    """POST /ai/knowledge — загрузка текста в personal RAG."""
    text: str = Field(min_length=1)
    source: str = "manual"


class KnowledgeDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: Optional[str] = None
    text: str
    created_at: Optional[object] = None
