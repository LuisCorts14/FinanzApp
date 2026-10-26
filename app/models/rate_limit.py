from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RateLimitHit(Base):
    """Contador de intentos por clave y ventana de tiempo.

    Vive en la base de datos (y no en memoria) porque en Vercel el backend corre en varias
    instancias efímeras: un contador en memoria no sería compartido entre ellas.
    """

    __tablename__ = "rate_limit_hits"

    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
