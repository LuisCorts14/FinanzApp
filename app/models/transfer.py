from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.account import Account


class Transfer(Base):
    """Dinero que se mueve entre dos cuentas propias. No es ingreso ni gasto, así que no entra en reportes."""

    __tablename__ = "transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    from_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    to_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    # Monto que sale, en la moneda de la cuenta de origen.
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # Monto que llega, en la moneda de la cuenta de destino (igual a amount si comparten moneda).
    to_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    from_account: Mapped["Account"] = relationship(foreign_keys=[from_account_id], back_populates="transfers_out")
    to_account: Mapped["Account"] = relationship(foreign_keys=[to_account_id], back_populates="transfers_in")
