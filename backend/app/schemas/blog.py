"""
Схемы блога.
BlogPostOut — карточка в списке, BlogPostDetail — страница статьи (с content в markdown).
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
    published_at: Optional[datetime] = None


class BlogPostDetail(BlogPostOut):
    content: str
