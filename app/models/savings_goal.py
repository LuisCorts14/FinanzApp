from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import TransactionType

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.savings_contribution import SavingsContribution


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    target_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    account: Mapped["Account | None"] = relationship()
    contributions: Mapped[list["SavingsContribution"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
        order_by="(SavingsContribution.date, SavingsContribution.id)",
    )

    @property
    def current_amount(self) -> float:
        """Metas con cuenta: el balance de la cuenta. Metas sin cuenta: la suma de sus abonos."""
        if self.account is not None:
            return float(self.account.balance)
        return round(sum(float(c.amount) for c in self.contributions), 2)

    @property
    def start_amount(self) -> float:
        """Lo que ya había ahorrado al crear la meta: el punto de partida del plan.

        Con cuenta: el balance actual menos los movimientos y transferencias registrados después de crear la meta.
        Sin cuenta: los abonos con fecha hasta el día de creación (p. ej. "Saldo inicial").
        """
        if self.account is not None:
            later = sum(
                float(t.amount) if t.category.type == TransactionType.INCOME else -float(t.amount)
                for t in self.account.transactions
                if t.created_at > self.created_at
            )
            later += sum(float(t.to_amount) for t in self.account.transfers_in if t.created_at > self.created_at)
            later -= sum(float(t.amount) for t in self.account.transfers_out if t.created_at > self.created_at)
            return round(max(float(self.account.balance) - later, 0), 2)
        created_day = self.created_at.date()
        return round(max(sum(float(c.amount) for c in self.contributions if c.date <= created_day), 0), 2)
