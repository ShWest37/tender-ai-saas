"""
Схемы аналитики решений площадок.
DecisionStats — точный контракт /decisions/stats (analytics-страница и dashboard).
"""
from typing import Optional

from pydantic import BaseModel


class DecisionStats(BaseModel):
    total_decisions: int = 0
    admitted_count: int = 0
    rejected_count: int = 0
    won_count: int = 0
    lost_count: int = 0
    average_place: Optional[float] = None
