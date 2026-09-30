"""AI-поиск поставщиков: источники прайс-листов, позиции, настройки, рубрики блога.

Revision ID: 0003_suppliers
Revises: 0002_ai_critic
Create Date: 2026-09-30 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# Идентификаторы ревизий, используемые Alembic.
revision = "0003_suppliers"
down_revision = "0002_ai_critic"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Рубрика блога — структурирует страницу /blog
    op.add_column("blog_posts", sa.Column("category", sa.String(length=100), nullable=True))

    # Глобальные настройки приложения (выбор категории по умолчанию и т.п.)
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value_json", sa.JSON(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_app_settings_id", "app_settings", ["id"])
    op.create_index("ix_app_settings_key", "app_settings", ["key"], unique=True)

    # Источники прайс-листов поставщиков / B2B-агрегаторов
    op.create_table(
        "supplier_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("supplier_name", sa.String(length=255), nullable=True),
        sa.Column("source_type", sa.String(length=20), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("price_list_url", sa.Text(), nullable=True),
        sa.Column("api_url", sa.Text(), nullable=True),
        sa.Column("api_key", sa.String(length=500), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=True),
        sa.Column("default_delivery_days", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("offers_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_supplier_sources_id", "supplier_sources", ["id"])
    op.create_index("ix_supplier_sources_slug", "supplier_sources", ["slug"], unique=True)

    # Позиции прайс-листов
    op.create_table(
        "supplier_offers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("supplier_sources.id"), nullable=False),
        sa.Column("supplier_name", sa.String(length=255), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("specs", sa.JSON(), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("stock", sa.Integer(), nullable=True),
        sa.Column("delivery_days", sa.Integer(), nullable=True),
        sa.Column("url", sa.String(length=1000), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("is_demo", sa.Boolean(), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_supplier_offers_id", "supplier_offers", ["id"])
    op.create_index("ix_supplier_offers_source_id", "supplier_offers", ["source_id"])


def downgrade() -> None:
    op.drop_index("ix_supplier_offers_source_id", table_name="supplier_offers")
    op.drop_index("ix_supplier_offers_id", table_name="supplier_offers")
    op.drop_table("supplier_offers")
    op.drop_index("ix_supplier_sources_slug", table_name="supplier_sources")
    op.drop_index("ix_supplier_sources_id", table_name="supplier_sources")
    op.drop_table("supplier_sources")
    op.drop_index("ix_app_settings_key", table_name="app_settings")
    op.drop_index("ix_app_settings_id", table_name="app_settings")
    op.drop_table("app_settings")
    op.drop_column("blog_posts", "category")
