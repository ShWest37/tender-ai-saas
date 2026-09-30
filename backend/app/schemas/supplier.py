"""
Схемы AI-поиска поставщиков: категории, источники прайсов, результаты сравнения.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    description: str = ""
    is_default: bool = False
    price_source: dict[str, Any] = Field(default_factory=dict)
    delivery_source: dict[str, Any] = Field(default_factory=dict)


class CategoriesOut(BaseModel):
    default: str
    categories: list[CategoryOut]


class SupplierSourceOut(BaseModel):
    """Источник прайс-листа в админ-панели."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    supplier_name: Optional[str] = None
    source_type: str
    category: Optional[str] = None
    category_label: Optional[str] = None
    website: Optional[str] = None
    price_list_url: Optional[str] = None
    api_url: Optional[str] = None
    currency: Optional[str] = "RUB"
    default_delivery_days: Optional[int] = 5
    is_active: bool = True
    offers_count: int = 0
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None


class SupplierSourceCreate(BaseModel):
    slug: Optional[str] = None
    name: str = Field(min_length=2, max_length=255)
    supplier_name: Optional[str] = None
    source_type: str = Field(default="csv", pattern="^(api|csv|xlsx|json|demo)$")
    category: Optional[str] = None
    website: Optional[str] = None
    price_list_url: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    currency: str = "RUB"
    default_delivery_days: int = Field(default=5, ge=0, le=120)
    is_active: bool = True


class SupplierSourceUpdate(BaseModel):
    name: Optional[str] = None
    supplier_name: Optional[str] = None
    source_type: Optional[str] = Field(default=None, pattern="^(api|csv|xlsx|json|demo)$")
    category: Optional[str] = None
    website: Optional[str] = None
    price_list_url: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    currency: Optional[str] = None
    default_delivery_days: Optional[int] = Field(default=None, ge=0, le=120)
    is_active: Optional[bool] = None


class SupplierSyncOut(BaseModel):
    source_id: int
    slug: str
    mode: str                      # remote | demo
    imported: int
    error: Optional[str] = None


class ComparisonOut(BaseModel):
    """Результат AI-сравнения «ТЗ ↔ строка прайса»."""
    match_percentage: float
    matched_specs: list[str] = Field(default_factory=list)
    mismatched_specs: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    engine: str = "deterministic"


class SupplierSearchRequest(BaseModel):
    tender_id: int
    category: Optional[str] = None
    limit: int = Field(default=8, ge=1, le=20)
    use_llm: bool = True


class SupplierResult(BaseModel):
    offer_id: int
    supplier: str
    source: str
    source_type: str
    is_demo: bool = False
    sku: Optional[str] = None
    title: str
    description: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = "шт"
    stock: Optional[int] = None
    delivery_days: Optional[int] = None
    url: Optional[str] = None
    comparison: ComparisonOut


class TenderBrief(BaseModel):
    id: int
    title: str
    platform: Optional[str] = None
    initial_price: Optional[float] = None
    region: Optional[str] = None
    submission_deadline: Optional[datetime] = None


class SupplierSearchResponse(BaseModel):
    tender: TenderBrief
    tz: dict[str, Any]
    category: str
    category_label: str
    results: list[SupplierResult]
    sources_checked: int = 0
    # True — подключённых прайсов нет, показан встроенный демо-каталог
    demo_catalog: bool = False
    checked_at: datetime
