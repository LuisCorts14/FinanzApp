from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.currency import get_exchange_rate
from app.core.institutions import get_institution, get_product
from app.db.base import Base
from app.models.enums import AccountType

if TYPE_CHECKING:
    from app.models.transaction import Transaction


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[AccountType] = mapped_column(nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="CLP")
    institution_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    product_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Solo para tarjetas de crédito: cupo total aprobado por el banco.
    credit_limit: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )

    @property
    def balance_base(self) -> float:
        rate = get_exchange_rate(self.currency)
        return round(float(self.balance) * rate, 2)

    @property
    def institution_name(self) -> str | None:
        institution = get_institution(self.institution_id) if self.institution_id else None
        return institution.name if institution else None

    @property
    def product_name(self) -> str | None:
        if not (self.institution_id and self.product_id):
            return None
        product = get_product(self.institution_id, self.product_id)
        return product.name if product else None
