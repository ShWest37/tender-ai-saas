"""Initial schema: все таблицы + расширение pgvector.

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy

# Идентификаторы ревизии, используются Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


# Нативные ENUM-типы PostgreSQL. Имена и значения совпадают с names() python-enum'ов
# в app/db/models.py (SQLAlchemy хранит .name, а не .value).
userrole = sa.Enum("USER", "ADMIN", name="userrole")
subscriptionplan = sa.Enum("START", "BUSINESS", "ENTERPRISE", name="subscriptionplan")
tenderstatus = sa.Enum("ACTIVE", "CLOSED", "CANCELLED", name="tenderstatus")
applicationstatus = sa.Enum(
    "DRAFT", "AI_GENERATED", "REVIEWED", "SUBMITTED", "WON", "LOST", "REJECTED",
    name="applicationstatus",
)
notificationchannel = sa.Enum("EMAIL", "MAX_MESSENGER", "BOTH", "NONE", name="notificationchannel")


def upgrade() -> None:
    # pgvector обязателен до создания knowledge_documents
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # === users ===
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("company_name", sa.String(length=500), nullable=True),
        sa.Column("inn", sa.String(length=20), nullable=True),
        sa.Column("role", userrole, nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("demo_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("subscription_plan", subscriptionplan, nullable=True),
        sa.Column("subscription_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("company_profile_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # === tenders ===
    op.create_table(
        "tenders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("platform", sa.String(length=100), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("law_type", sa.String(length=20), nullable=True),
        sa.Column("initial_price", sa.Float(), nullable=True),
        sa.Column("okpd2_codes", sa.JSON(), nullable=True),
        sa.Column("region", sa.String(length=255), nullable=True),
        sa.Column("customer_name", sa.String(length=500), nullable=True),
        sa.Column("customer_inn", sa.String(length=20), nullable=True),
        sa.Column("submission_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", tenderstatus, nullable=True),
        sa.Column("documentation_url", sa.Text(), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("parsed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_tenders_id", "tenders", ["id"])
    op.create_index("ix_tenders_external_id", "tenders", ["external_id"], unique=True)

    # === applications ===
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("tender_id", sa.Integer(), sa.ForeignKey("tenders.id"), nullable=True),
        sa.Column("status", applicationstatus, nullable=True),
        sa.Column("generated_content", sa.JSON(), nullable=True),
        sa.Column("final_content", sa.JSON(), nullable=True),
        sa.Column("ai_confidence_score", sa.Float(), nullable=True),
        sa.Column("critic_report", sa.JSON(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result_price", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_applications_id", "applications", ["id"])

    # === payments ===
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("yookassa_payment_id", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column("plan", subscriptionplan, nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_payments_id", "payments", ["id"])
    op.create_index("ix_payments_yookassa_payment_id", "payments", ["yookassa_payment_id"], unique=True)

    # === blog_posts ===
    op.create_table(
        "blog_posts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("slug", sa.String(length=500), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("cover_image_url", sa.String(length=500), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=True),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_blog_posts_id", "blog_posts", ["id"])
    op.create_index("ix_blog_posts_slug", "blog_posts", ["slug"], unique=True)

    # === notifications ===
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("channel", sa.String(length=20), nullable=True),
        sa.Column("type", sa.String(length=50), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_id", "notifications", ["id"])

    # === notification_preferences ===
    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("new_tender_channel", notificationchannel, nullable=True),
        sa.Column("application_submitted_channel", notificationchannel, nullable=True),
        sa.Column("application_accepted_channel", notificationchannel, nullable=True),
        sa.Column("application_rejected_channel", notificationchannel, nullable=True),
        sa.Column("tender_won_channel", notificationchannel, nullable=True),
        sa.Column("tender_lost_channel", notificationchannel, nullable=True),
        sa.Column("payment_success_channel", notificationchannel, nullable=True),
        sa.Column("demo_expiring_channel", notificationchannel, nullable=True),
        sa.Column("ai_generation_complete_channel", notificationchannel, nullable=True),
        sa.Column("email_enabled", sa.Boolean(), nullable=True),
        sa.Column("max_enabled", sa.Boolean(), nullable=True),
        sa.Column("max_chat_id", sa.String(length=255), nullable=True),
        sa.Column("quiet_hours_start", sa.String(length=5), nullable=True),
        sa.Column("quiet_hours_end", sa.String(length=5), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notification_preferences_id", "notification_preferences", ["id"])
    op.create_index("ix_notification_preferences_user_id", "notification_preferences", ["user_id"], unique=True)

    # === in_app_notifications ===
    op.create_table(
        "in_app_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("related_tender_id", sa.Integer(), sa.ForeignKey("tenders.id"), nullable=True),
        sa.Column("related_application_id", sa.Integer(), sa.ForeignKey("applications.id"), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("action_url", sa.String(length=500), nullable=True),
        sa.Column("action_label", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_in_app_notifications_id", "in_app_notifications", ["id"])
    op.create_index("ix_in_app_notifications_user_id", "in_app_notifications", ["user_id"])
    op.create_index("ix_in_app_notifications_is_read", "in_app_notifications", ["is_read"])
    op.create_index("ix_in_app_notifications_created_at", "in_app_notifications", ["created_at"])

    # === tender_decisions ===
    op.create_table(
        "tender_decisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tender_id", sa.Integer(), sa.ForeignKey("tenders.id"), nullable=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id"), nullable=True),
        sa.Column("decision_type", sa.String(length=100), nullable=True),
        sa.Column("decision_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_admitted", sa.Boolean(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("winner_price", sa.Float(), nullable=True),
        sa.Column("winner_name", sa.String(length=500), nullable=True),
        sa.Column("winner_inn", sa.String(length=20), nullable=True),
        sa.Column("place_number", sa.Integer(), nullable=True),
        sa.Column("total_participants", sa.Integer(), nullable=True),
        sa.Column("document_url", sa.Text(), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("parsed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_tender_decisions_id", "tender_decisions", ["id"])

    # === parser_configs ===
    op.create_table(
        "parser_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("platform_name", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("api_url", sa.String(length=500), nullable=True),
        sa.Column("api_key", sa.String(length=500), nullable=True),
        sa.Column("schedule_cron", sa.String(length=100), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("config_json", sa.JSON(), nullable=True),
    )
    op.create_index("ix_parser_configs_id", "parser_configs", ["id"])
    op.create_index("ix_parser_configs_platform_name", "parser_configs", ["platform_name"], unique=True)

    # === knowledge_documents (pgvector) ===
    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=500), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(dim=768), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_knowledge_documents_id", "knowledge_documents", ["id"])


def downgrade() -> None:
    op.drop_table("knowledge_documents")
    op.drop_table("parser_configs")
    op.drop_table("tender_decisions")
    op.drop_table("in_app_notifications")
    op.drop_table("notification_preferences")
    op.drop_table("notifications")
    op.drop_table("blog_posts")
    op.drop_table("payments")
    op.drop_table("applications")
    op.drop_table("tenders")
    op.drop_table("users")

    userrole.drop(op.get_bind(), checkfirst=True)
    subscriptionplan.drop(op.get_bind(), checkfirst=True)
    tenderstatus.drop(op.get_bind(), checkfirst=True)
    applicationstatus.drop(op.get_bind(), checkfirst=True)
    notificationchannel.drop(op.get_bind(), checkfirst=True)
