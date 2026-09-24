"""
Схемы тендеров.
Поля TenderOut совпадают с interface Tender на странице /dashboard/tenders.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TenderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: Optional[str] = None
    platform: Optional[str] = None
    title: str
    law_type: Optional[str] = None
    initial_price: Optional[float] = None
    region: Optional[str] = None
    customer_name: Optional[str] = None
    submission_deadline: Optional[datetime] = None
    status: str


class TenderCountOut(BaseModel):
    """Ответ /tenders/count: фронт читает поле count."""
    count: int
