from datetime import datetime

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReceiptScan(Base):
    """Registro de cada escaneo de boleta, para limitar cuántos hace cada persona por día. No guarda la foto."""

    __tablename__ = "receipt_scans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
