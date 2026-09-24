"""
ORM модели базы данных PostgreSQL.
Все сущности: пользователи, тендеры, заявки, подписки, статьи блога,
уведомления, решения площадок, векторные документы (pgvector).
"""
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Float,
    ForeignKey, Enum, JSON, Date
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.dialects.postgresql import JSON as PG_JSON
from pgvector.sqlalchemy import Vector  # ✅ pgvector для векторных эмбеддингов


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class SubscriptionPlan(str, enum.Enum):
    START = "start"         # 15 000 ₽
    BUSINESS = "business"   # 35 000 ₽
    ENTERPRISE = "enterprise"  # 100 000 ₽


class TenderStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ApplicationStatus(str, enum.Enum):
    DRAFT = "draft"
    AI_GENERATED = "ai_generated"
    REVIEWED = "reviewed"
    SUBMITTED = "submitted"
    WON = "won"
    LOST = "lost"
    REJECTED = "rejected"


class NotificationChannel(str, enum.Enum):
    EMAIL = "email"
    MAX_MESSENGER = "max"
    BOTH = "both"
    NONE = "none"


class NotificationType(str, enum.Enum):
    NEW_TENDER_FOUND = "new_tender_found"
    APPLICATION_SUBMITTED = "application_submitted"
    APPLICATION_ACCEPTED = "application_accepted"
    APPLICATION_REJECTED = "application_rejected"
    TENDER_WON = "tender_won"
    TENDER_LOST = "tender_lost"
    PAYMENT_SUCCESS = "payment_success"
    DEMO_EXPIRING = "demo_expiring"
    AI_GENERATION_COMPLETE = "ai_generation_complete"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    company_name = Column(String(500))
    inn = Column(String(20))
    role = Column(Enum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    demo_expires_at = Column(DateTime(timezone=True), nullable=True)
    subscription_plan = Column(Enum(SubscriptionPlan), nullable=True)
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    company_profile_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    applications = relationship("Application", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    notification_preferences = relationship("NotificationPreference", back_populates="user", uselist=False)
    in_app_notifications = relationship("InAppNotification", back_populates="user")
    knowledge_documents = relationship("KnowledgeDocument", back_populates="user")


class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(255), unique=True, index=True)
    platform = Column(String(100))
    title = Column(Text, nullable=False)
    description = Column(Text)
    law_type = Column(String(20))
    initial_price = Column(Float)
    okpd2_codes = Column(JSON)
    region = Column(String(255))
    customer_name = Column(String(500))
    customer_inn = Column(String(20))
    submission_deadline = Column(DateTime(timezone=True))
    status = Column(Enum(TenderStatus), default=TenderStatus.ACTIVE)
    documentation_url = Column(Text)
    raw_data = Column(JSON)
    parsed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    applications = relationship("Application", back_populates="tender")
    decisions = relationship("TenderDecision", back_populates="tender")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tender_id = Column(Integer, ForeignKey("tenders.id"))
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.DRAFT)
    generated_content = Column(JSON)
    final_content = Column(JSON)
    ai_confidence_score = Column(Float)
    critic_report = Column(JSON)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    result_price = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="applications")
    tender = relationship("Tender", back_populates="applications")
    decisions = relationship("TenderDecision", back_populates="application")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    yookassa_payment_id = Column(String(255), unique=True)
    amount = Column(Float)
    plan = Column(Enum(SubscriptionPlan))
    status = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    slug = Column(String(500), unique=True, index=True)
    excerpt = Column(Text)
    content = Column(Text, nullable=False)
    cover_image_url = Column(String(500), nullable=True)
    is_published = Column(Boolean, default=False)
    author_id = Column(Integer, ForeignKey("users.id"))
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    channel = Column(String(20))
    type = Column(String(50))
    title = Column(String(500))
    body = Column(Text)
    is_read = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notifications")


class NotificationPreference(Base):
    """
    Настройки уведомлений пользователя.
    По умолчанию: Email включен, MAX отключен.
    In-app уведомления ВСЕГДА включены (не настраиваются).
    """
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Каналы для каждого типа (по умолчанию: email)
    new_tender_channel = Column(Enum(NotificationChannel), default=NotificationChannel.EMAIL)
    application_submitted_channel = Column(Enum(NotificationChannel), default=NotificationChannel.EMAIL)
    application_accepted_channel = Column(Enum(NotificationChannel), default=NotificationChannel.EMAIL)
    application_rejected_channel = Column(Enum(NotificationChannel), default=NotificationChannel.EMAIL)
    tender_won_channel = Column(Enum(NotificationChannel), default=NotificationChannel.EMAIL)
    tender_lost_channel = Column(Enum(NotificationChannel), default=NotificationChannel.EMAIL)
    payment_success_channel = Column(Enum(NotificationChannel), default=NotificationChannel.EMAIL)
    demo_expiring_channel = Column(Enum(NotificationChannel), default=NotificationChannel.EMAIL)
    ai_generation_complete_channel = Column(Enum(NotificationChannel), default=NotificationChannel.EMAIL)
    
    email_enabled = Column(Boolean, default=True)
    max_enabled = Column(Boolean, default=False)  # ✅ MAX отключен по умолчанию
    max_chat_id = Column(String(255), nullable=True)
    quiet_hours_start = Column(String(5), nullable=True)
    quiet_hours_end = Column(String(5), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notification_preferences")


class InAppNotification(Base):
    """
    Уведомления внутри Личного Кабинета.
    ВСЕГДА создаются, независимо от настроек пользователя.
    Отображаются в колокольчике TopBar.
    """
    __tablename__ = "in_app_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notification_type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    related_tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=True)
    related_application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    action_url = Column(String(500), nullable=True)
    action_label = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User", back_populates="in_app_notifications")


class TenderDecision(Base):
    """
    Реестр решений тендерных площадок.
    """
    __tablename__ = "tender_decisions"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"))
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    decision_type = Column(String(100))
    decision_date = Column(DateTime(timezone=True))
    is_admitted = Column(Boolean, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    winner_price = Column(Float, nullable=True)
    winner_name = Column(String(500), nullable=True)
    winner_inn = Column(String(20), nullable=True)
    place_number = Column(Integer, nullable=True)
    total_participants = Column(Integer, nullable=True)
    document_url = Column(Text, nullable=True)
    raw_data = Column(JSON)
    parsed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    tender = relationship("Tender", back_populates="decisions")
    application = relationship("Application", back_populates="decisions")


class ParserConfig(Base):
    """Конфигурация парсеров площадок."""
    __tablename__ = "parser_configs"

    id = Column(Integer, primary_key=True, index=True)
    platform_name = Column(String(100), unique=True)
    is_active = Column(Boolean, default=True)
    api_url = Column(String(500), nullable=True)
    api_key = Column(String(500), nullable=True)
    schedule_cron = Column(String(100), default="*/15 * * * *")
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    config_json = Column(JSON, nullable=True)


class KnowledgeDocument(Base):
    """
    Векторное хранилище документов для RAG (pgvector).
    Заменяет Milvus. Хранится прямо в PostgreSQL.
    
    Что сюда попадает:
    - Реквизиты компании (из загруженного Word)
    - Прошлые победные заявки
    - ГОСТы и технические регламенты
    - Ответы на запросы разъяснений
    """
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    text = Column(Text, nullable=False)
    source = Column(String(500))
    metadata_json = Column(JSON)
    embedding = Column(Vector(768))  # ✅ 768 — размерность эмбеддингов YandexGPT
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="knowledge_documents")