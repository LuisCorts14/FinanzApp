from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["critical", "warning", "info", "good"]


class Notification(BaseModel):
    key: str
    kind: str
    severity: Severity
    title: str
    message: str
    link: str


class NotificationRead(Notification):
    read: bool


class NotificationList(BaseModel):
    items: list[NotificationRead]
    unread_count: int


class MarkReadRequest(BaseModel):
    # Sin keys: se marcan como leídas todas las notificaciones actuales.
    keys: list[str] | None = Field(default=None, max_length=200)
