"""
Роутер блога.
GET /blog — только is_published, с пагинацией; GET /blog/{slug} — статья с markdown-контентом.
POST /blog — создать статью (админ); PUT /blog/{id} — обновить (админ); DELETE /blog/{id} — удалить (админ).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import BlogPost
from app.schemas.blog import BlogPostOut, BlogPostDetail, BlogPostCreate, BlogPostUpdate

router = APIRouter()


@router.get("", response_model=list[BlogPostOut])
async def list_posts(
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(9, ge=1, le=50),
    query: Optional[str] = Query(None, description="Поиск по заголовку/аннотации/тексту"),
    category: Optional[str] = Query(None, description="Фильтр по рубрике"),
    db: AsyncSession = Depends(get_db),
):
    filters = [BlogPost.is_published.is_(True)]
    if query:
        like = f"%{query.strip()}%"
        filters.append(
            BlogPost.title.ilike(like)
            | BlogPost.excerpt.ilike(like)
            | BlogPost.content.ilike(like)
        )
    if category:
        filters.append(BlogPost.category == category)

    # Общее число статей фронт читает из заголовка X-Total-Count (пагинация)
    total = (
        await db.execute(select(func.count(BlogPost.id)).where(*filters))
    ).scalar_one()

    stmt = (
        select(BlogPost)
        .where(*filters)
        .order_by(BlogPost.published_at.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    response.headers["X-Total-Count"] = str(total)
    return result.scalars().all()


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Рубрики блога с количеством опубликованных статей."""
    stmt = (
        select(BlogPost.category, func.count(BlogPost.id))
        .where(BlogPost.is_published.is_(True), BlogPost.category.isnot(None))
        .group_by(BlogPost.category)
        .order_by(func.count(BlogPost.id).desc())
    )
    rows = (await db.execute(stmt)).all()
    return [{"category": category, "count": count} for category, count in rows if category]


@router.get("/all", response_model=list[BlogPostOut])
async def list_all_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Список всех статей (включая черновики) — для админ-панели."""
    stmt = (
        select(BlogPost)
        .order_by(BlogPost.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/id/{post_id}", response_model=BlogPostDetail)
async def get_post_by_id(post_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(BlogPost).where(BlogPost.id == post_id)
    post = (await db.execute(stmt)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Статья не найдена")
    return post


@router.get("/{slug}", response_model=BlogPostDetail)
async def get_post(slug: str, db: AsyncSession = Depends(get_db)):
    stmt = select(BlogPost).where(BlogPost.slug == slug, BlogPost.is_published.is_(True))
    post = (await db.execute(stmt)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Статья не найдена")
    return post


@router.post("", response_model=BlogPostDetail, status_code=status.HTTP_201_CREATED)
async def create_post(
    data: BlogPostCreate,
    db: AsyncSession = Depends(get_db),
):
    """Создание новой статьи (только для админа)."""
    post = BlogPost(
        title=data.title,
        slug=data.slug,
        excerpt=data.excerpt,
        content=data.content,
        cover_image_url=data.cover_image_url,
        category=(data.category or None),
        is_published=data.is_published,
        published_at=data.published_at,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@router.put("/{post_id}", response_model=BlogPostDetail)
async def update_post(
    post_id: int,
    data: BlogPostUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновление статьи (только для админа)."""
    stmt = select(BlogPost).where(BlogPost.id == post_id)
    post = (await db.execute(stmt)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Статья не найдена")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(post, field, value)

    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Удаление статьи (только для админа)."""
    stmt = select(BlogPost).where(BlogPost.id == post_id)
    post = (await db.execute(stmt)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Статья не найдена")

    await db.delete(post)
    await db.commit()
    return None
