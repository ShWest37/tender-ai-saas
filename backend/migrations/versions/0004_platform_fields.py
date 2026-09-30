"""Тендерные площадки: наименование и адрес сайта в parser_configs.

Revision ID: 0004_platform_fields
Revises: 0003_suppliers
Create Date: 2026-09-30 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# Идентификаторы ревизий, используемые Alembic.
revision = "0004_platform_fields"
down_revision = "0003_suppliers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Человекочитаемое название площадки («Сбербанк-АСТ», а не platform_name)
    op.add_column("parser_configs", sa.Column("name", sa.String(length=200), nullable=True))
    # Адрес сайта площадки (api_url хранит API-адрес — это разные поля)
    op.add_column("parser_configs", sa.Column("url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("parser_configs", "url")
    op.drop_column("parser_configs", "name")
