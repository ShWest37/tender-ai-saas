"""
Сборный роутер API.
Каждый доменный роутер подключается сюда; монтируется в main под /api/v1.
"""
from fastapi import APIRouter

from app.api.routers import auth, tenders, applications, decisions, blog, payments, notifications, ai

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(tenders.router, prefix="/tenders", tags=["tenders"])
api_router.include_router(applications.router, prefix="/applications", tags=["applications"])
api_router.include_router(decisions.router, prefix="/decisions", tags=["decisions"])
api_router.include_router(blog.router, prefix="/blog", tags=["blog"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
