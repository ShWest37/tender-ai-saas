"""
Схемы авторизации и профиля.
Поля UserOut подобраны строго под useAuth.ts и billing/settings страницы фронта.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    company_name: Optional[str] = Field(default=None, max_length=500)
    inn: Optional[str] = Field(default=None, max_length=20)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    # Фронт ждёт ровно эти два поля (useAuth.ts, модалки)
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    """Ответ /auth/me. subscription_expires_at и demo_expires_at читает billing-страница."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    inn: Optional[str] = None
    role: str
    is_active: bool
    subscription_plan: Optional[str] = None
    subscription_expires_at: Optional[datetime] = None
    demo_expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class ProfileUpdate(BaseModel):
    """PUT /auth/profile: поля со страницы Настройки (email не меняется)."""
    full_name: Optional[str] = Field(default=None, max_length=255)
    company_name: Optional[str] = Field(default=None, max_length=500)
    inn: Optional[str] = Field(default=None, max_length=20)
