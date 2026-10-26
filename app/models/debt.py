from datetime import datetime

from sqlalchemy import ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Debt(Base):
    """Deudas que no son una cuenta de la app: créditos de consumo, avances, préstamos, etc.

    Las tarjetas de crédito no van aquí: su deuda es el saldo negativo de la cuenta.
    """

    __tablename__ = "debts"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)  # valores de DebtKind
    balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)  # lo que falta pagar, en CLP
    interest_rate: Mapped[float] = mapped_column(Numeric(6, 3), nullable=False, default=0)  # % mensual
    minimum_payment: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
