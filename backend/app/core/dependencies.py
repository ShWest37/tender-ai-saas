"""
Зависимости FastAPI: получение текущего пользователя, проверка ролей.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import User, UserRole
from app.core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # В JWT sub хранится строка — приводим к int, иначе сравнение с User.id не сработает
    raw_sub = payload.get("sub")
    if raw_sub is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    try:
        user_id = int(raw_sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def has_active_access(user: User) -> bool:
    """
    Активен ли доступ: платная подписка в силе ИЛИ не истёк демо-период.
    """
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    def _aware(dt) -> bool:
        # SQLite в тестах может вернуть naive datetime — нормализуем к UTC
        aware = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        return aware > now

    if user.subscription_plan and user.subscription_expires_at:
        if _aware(user.subscription_expires_at):
            return True
    if user.demo_expires_at and _aware(user.demo_expires_at):
        return True
    return False


async def require_active_subscription(current_user: User = Depends(get_current_user)) -> User:
    """
    Доступ только при активной подписке или активном демо-периоде.
    Используется для платных действий (поиск тендеров, генерация заявок).
    """
    if not has_active_access(current_user):
        raise HTTPException(
            status_code=402,
            detail="Требуется активная подписка или демо-период",
        )
    return current_user