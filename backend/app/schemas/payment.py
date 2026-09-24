"""
Схемы платежей (YooKassa).
Фронт шлёт {plan}, читает ответ {confirmation_url}.
"""
from pydantic import BaseModel, field_validator


class PaymentCreateRequest(BaseModel):
    plan: str

    @field_validator("plan")
    @classmethod
    def _validate_plan(cls, v: str) -> str:
        allowed = {"start", "business", "enterprise"}
        if v not in allowed:
            raise ValueError(f"Недопустимый тариф. Выберите один из: {', '.join(sorted(allowed))}")
        return v


class PaymentCreateResponse(BaseModel):
    confirmation_url: str
