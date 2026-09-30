"""
Схемы заявок.
ApplicationTenderBrief — вложенный объект tender, который рендерит /dashboard/applications.
ApplicationDetail — полная карточка заявки для страницы AI-агента (с отчётом критика).
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ApplicationTenderBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    platform: Optional[str] = None
    initial_price: Optional[float] = None
    law_type: Optional[str] = None
    customer_name: Optional[str] = None
    submission_deadline: Optional[datetime] = None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tender_id: int
    status: str
    ai_confidence_score: Optional[float] = None
    submitted_at: Optional[datetime] = None
    result_price: Optional[float] = None
    created_at: Optional[datetime] = None
    tender: Optional[ApplicationTenderBrief] = None


class ApplicationDetail(ApplicationOut):
    """Полная карточка заявки: контент, отчёты критика, статус подтверждения."""
    generated_content: Optional[dict] = None
    final_content: Optional[dict] = None
    critic_report: Optional[dict] = None
    deterministic_report: Optional[dict] = None
    disclaimer_accepted: bool = False
    review_confirmed_at: Optional[datetime] = None
    review_notes: Optional[str] = None


class ApplicationCreate(BaseModel):
    """POST /applications — создать черновик заявки под тендер."""
    tender_id: int


class ApplicationUpdate(BaseModel):
    """PATCH /applications/{id} — правка финального контента/статуса."""
    status: Optional[str] = None
    final_content: Optional[dict] = None
    result_price: Optional[float] = None
