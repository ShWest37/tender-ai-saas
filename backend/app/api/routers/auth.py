"""
Роутер авторизации: регистрация (с демо-периодом), вход, профиль.
Контракты подобраны под useAuth.ts и модалки/страницы фронта.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User, UserRole, NotificationPreference
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
)
from app.core.dependencies import get_current_user
from app.core.config import get_settings
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserOut,
    ProfileUpdate,
)

router = APIRouter()
settings = get_settings()


def _issue_tokens(user: User) -> TokenResponse:
    """Пара токенов. sub храним строкой — так принято в JWT и это учтено в get_current_user."""
    subject = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(select(User).where(User.email == payload.email))
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email уже зарегистрирован")

    now = datetime.now(timezone.utc)
    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        company_name=payload.company_name,
        inn=payload.inn,
        role=UserRole.USER,
        is_active=True,
        # Демо-доступ на DEMO_DAYS дней без карты
        demo_expires_at=now + timedelta(days=settings.DEMO_DAYS),
    )
    db.add(user)
    await db.flush()

    # Настройки уведомлений по умолчанию (email вкл, MAX выкл)
    db.add(NotificationPreference(user_id=user.id))
    await db.commit()

    return _issue_tokens(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт отключён")

    return _issue_tokens(user)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> User:
    # billing-страница читает subscription_plan, subscription_expires_at, demo_expires_at
    return current_user


@router.put("/profile", response_model=UserOut)
async def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Email намеренно не обновляется (заблокирован и на фронте)
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.company_name is not None:
        current_user.company_name = payload.company_name
    if payload.inn is not None:
        current_user.inn = payload.inn

    await db.commit()
    await db.refresh(current_user)
    return current_user
