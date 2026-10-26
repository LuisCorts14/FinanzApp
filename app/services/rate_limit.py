"""Límite de intentos (rate limiting) con ventanas fijas guardadas en Postgres."""

import math
import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.rate_limit import RateLimitHit


@dataclass(frozen=True)
class Limit:
    times: int
    seconds: int


# Límites por acción. "ip" cuenta por dirección IP; "key" por email o usuario.
LOGIN_PER_EMAIL = Limit(5, 60)
LOGIN_PER_IP = Limit(20, 60)
REGISTER_PER_IP = Limit(5, 3600)
FORGOT_PER_EMAIL = Limit(3, 3600)
FORGOT_PER_IP = Limit(10, 3600)
RESET_PER_IP = Limit(10, 900)
SENSITIVE_PER_USER = Limit(5, 900)  # cambiar contraseña / eliminar cuenta
DEMO_PER_IP = Limit(30, 3600)


def client_ip(request: Request) -> str:
    """IP real del cliente. En Vercel llega en x-real-ip / x-forwarded-for (los define la plataforma)."""
    if settings.is_serverless:
        real = request.headers.get("x-real-ip")
        if real:
            return real.strip()
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _hit(db: Session, key: str, limit: Limit) -> int | None:
    """Suma un intento; devuelve los segundos de espera si se pasó del límite, o None si está permitido."""
    now = time.time()
    window_start = math.floor(now / limit.seconds) * limit.seconds
    stmt = (
        insert(RateLimitHit)
        .values(key=key, window_start=datetime.fromtimestamp(window_start, tz=timezone.utc).replace(tzinfo=None), count=1)
        .on_conflict_do_update(index_elements=["key", "window_start"], set_={"count": RateLimitHit.count + 1})
        .returning(RateLimitHit.count)
    )
    count = db.execute(stmt).scalar_one()
    # Limpieza ocasional de ventanas viejas para que la tabla no crezca.
    if random.random() < 0.02:
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
        db.execute(delete(RateLimitHit).where(RateLimitHit.window_start < cutoff))
    db.commit()
    if count > limit.times:
        return max(int(window_start + limit.seconds - now), 1)
    return None


def enforce(db: Session, scope: str, checks: list[tuple[str, Limit]]) -> None:
    """Registra el intento en cada contador y responde 429 si alguno superó su límite.

    `checks` es una lista de (identificador, límite), p. ej. [("ip:1.2.3.4", LOGIN_PER_IP)].
    """
    if not settings.RATE_LIMIT_ENABLED:
        return
    waits = [w for ident, limit in checks if (w := _hit(db, f"{scope}:{ident}", limit)) is not None]
    if waits:
        wait = max(waits)
        minutes = math.ceil(wait / 60)
        when = f"{wait} segundos" if wait < 60 else f"{minutes} minuto{'s' if minutes > 1 else ''}"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiados intentos. Espera {when} antes de volver a intentarlo.",
            headers={"Retry-After": str(wait)},
        )
