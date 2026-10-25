from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationRead(Base):
    """Qué avisos ya vio la persona. Los avisos en sí se calculan al momento (app/services/notifications.py)."""

    __tablename__ = "notification_reads"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_notification_reads_user_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    read_at: Mapped[datetime] = mapped_column(server_default=func.now())
