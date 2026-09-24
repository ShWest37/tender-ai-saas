"""
Схемы заявок.
ApplicationTenderBrief — вложенный объект tender, который рендерит /dashboard/applications.
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


class ApplicationCreate(BaseModel):
    """POST /applications — создать черновик заявки под тендер."""
    tender_id: int


class ApplicationUpdate(BaseModel):
    """PATCH /applications/{id} — правка финального контента/статуса."""
    status: Optional[str] = None
    final_content: Optional[dict] = None
    result_price: Optional[float] = None
