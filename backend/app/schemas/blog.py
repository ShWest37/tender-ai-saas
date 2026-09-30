"""
Схемы блога.
BlogPostOut — карточка в списке, BlogPostDetail — страница статьи (с content в markdown).
BlogPostCreate/Update — для создания и редактирования статей.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BlogPostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    published_at: Optional[datetime] = None


class BlogPostDetail(BlogPostOut):
    content: str


class BlogPostCreate(BaseModel):
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: str
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    is_published: bool = False
    published_at: Optional[datetime] = None


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    is_published: Optional[bool] = None
    published_at: Optional[datetime] = None
