"""AI-critic: детерминированный отчёт, дисклеймер и подтверждение проверки.

Revision ID: 0002_ai_critic
Revises: 0001_initial
Create Date: 2026-09-29 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# Идентификаторы ревизии, используются Alembic.
revision = "0002_ai_critic"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("deterministic_report", sa.JSON(), nullable=True))
    op.add_column("applications", sa.Column("disclaimer_accepted", sa.Boolean(), nullable=True))
    op.add_column("applications", sa.Column("review_confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("applications", sa.Column("review_confirmed_by", sa.Integer(), nullable=True))
    op.add_column("applications", sa.Column("review_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "review_notes")
    op.drop_column("applications", "review_confirmed_by")
    op.drop_column("applications", "review_confirmed_at")
    op.drop_column("applications", "disclaimer_accepted")
    op.drop_column("applications", "deterministic_report")
