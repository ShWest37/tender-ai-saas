"""
Схемы уведомлений: in-app (колокольчик) и настроек каналов.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class InAppNotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notification_type: str
    title: str
    body: str
    related_tender_id: Optional[int] = None
    related_application_id: Optional[int] = None
    is_read: bool
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    created_at: Optional[datetime] = None


class UnreadCountOut(BaseModel):
    unread_count: int


class NotificationPreferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email_enabled: bool
    max_enabled: bool
    max_chat_id: Optional[str] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


class NotificationPreferenceUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    max_enabled: Optional[bool] = None
    max_chat_id: Optional[str] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
