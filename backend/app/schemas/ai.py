"""
Схемы AI-агента: генерация заявки, критика, подтверждение проверки,
загрузка документов в базу знаний.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.application import ApplicationDetail


class GenerateApplicationRequest(BaseModel):
    """POST /ai/generate-application — запуск генерации заявки по тендеру."""
    tender_id: int
    # Если задан — переиспользуем существующую заявку (draft), иначе создаём новую
    application_id: Optional[int] = None


class GenerateApplicationResponse(BaseModel):
    task_id: str
    status: str = "queued"


class DeterministicCheckOut(BaseModel):
    """Результат одной детерминированной проверки."""
    code: str
    name: str
    status: str          # pass | fail | warn | skipped
    severity: str        # critical | major | minor
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class CriticIssueOut(BaseModel):
    """Замечание критика (детерминированное или LLM)."""
    severity: str
    field: Optional[str] = None
    message: str
    evidence_quote: Optional[str] = None
    grounded: Optional[bool] = None
    source: Optional[str] = None  # deterministic | llm


class CritiqueRequest(BaseModel):
    """POST /ai/applications/{id}/critique — параметры запуска критика."""
    # Разрешить вызов LLM (False — только детерминированные проверки).
    use_llm: bool = True


class CritiqueResponse(BaseModel):
    """
    Отчёт AI-критика по заявке.

    Синхронно возвращается детерминированная часть; LLM-часть ставится в Celery.
    llm_status: pending (в очереди) | completed | unavailable | skipped.
    """
    model_config = ConfigDict(from_attributes=True)

    application_id: int
    status: str
    confidence: Optional[float] = None
    admitted: bool = False
    requires_manual_review: bool = True
    issues: list[CriticIssueOut] = Field(default_factory=list)
    not_found: list[str] = Field(default_factory=list)
    hallucinated_evidence: list[str] = Field(default_factory=list)
    grounding: dict[str, Any] = Field(default_factory=dict)
    deterministic: dict[str, Any] = Field(default_factory=dict)
    disclaimer_required: bool = True
    checked_at: Optional[str] = None
    # --- Состояние фонового LLM-этапа ---
    llm_status: str = "completed"
    task_id: Optional[str] = None


class ConfirmReviewRequest(BaseModel):
    """
    POST /ai/applications/{id}/confirm-review — подтверждение проверки пользователем.
    Без disclaimer_accepted=true подтверждение невозможно.
    """
    disclaimer_accepted: bool
    notes: Optional[str] = Field(default=None, max_length=2000)


class ConfirmReviewResponse(BaseModel):
    """Результат подтверждения проверки."""
    model_config = ConfigDict(from_attributes=True)

    application: ApplicationDetail
    disclaimer_accepted: bool
    review_confirmed_at: Optional[datetime] = None


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
