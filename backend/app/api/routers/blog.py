"""
Роутер блога (публичный).
GET /blog — только is_published, с пагинацией; GET /blog/{slug} — статья с markdown-контентом.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import BlogPost
from app.schemas.blog import BlogPostOut, BlogPostDetail

router = APIRouter()


@router.get("", response_model=list[BlogPostOut])
async def list_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(9, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(BlogPost)
        .where(BlogPost.is_published.is_(True))
        .order_by(BlogPost.published_at.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{slug}", response_model=BlogPostDetail)
async def get_post(slug: str, db: AsyncSession = Depends(get_db)):
    stmt = select(BlogPost).where(BlogPost.slug == slug, BlogPost.is_published.is_(True))
    post = (await db.execute(stmt)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Статья не найдена")
    return post
