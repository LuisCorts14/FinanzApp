from datetime import datetime

from sqlalchemy import Numeric, Boolean, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Se incrementa al cambiar la contraseña: los tokens emitidos antes dejan de ser válidos.
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # Cuenta demo pública: cualquiera entra con "Probar la demo", así que no se puede cambiar su acceso ni borrarla.
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    # Configuración personal
    payday: Mapped[int | None] = mapped_column(Integer, nullable=True)  # día del mes en que llega el sueldo
    savings_target_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=20, server_default="20")
    budget_alert_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=80, server_default="80")
    # Sin llave foránea a propósito (users y accounts se apuntarían mutuamente): se valida al guardar y,
    # si la cuenta ya no existe, la configuración la informa como vacía.
    default_account_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Plan de deudas: cuánto puede pagar al mes y qué deuda priorizar ("avalanche" o "snowball").
    debt_monthly_budget: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    debt_strategy: Mapped[str] = mapped_column(String(20), nullable=False, default="avalanche", server_default="avalanche")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
