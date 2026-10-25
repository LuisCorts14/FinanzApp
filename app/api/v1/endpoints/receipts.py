from datetime import timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.category import Category
from app.models.enums import TransactionType
from app.models.receipt_scan import ReceiptScan
from app.models.user import User
from app.schemas.receipt import ReceiptGroup, ReceiptItemRead, ReceiptQuota, ReceiptScanResult
from app.services.receipt_scanner import (
    SUPPORTED_MEDIA_TYPES,
    ReceiptScanError,
    ReceiptServiceUnavailable,
    extract_receipt,
    parse_receipt_date,
)

router = APIRouter(prefix="/receipts", tags=["receipts"])

# La API de Claude acepta imágenes de hasta 5 MB; el frontend las reduce antes de enviarlas.
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _quota(db: Session, user: User) -> ReceiptQuota:
    used = db.scalar(
        select(func.count())
        .select_from(ReceiptScan)
        .where(ReceiptScan.user_id == user.id, ReceiptScan.created_at > func.now() - timedelta(hours=24))
    )
    limit = settings.RECEIPT_SCANS_PER_DAY
    return ReceiptQuota(
        enabled=bool(settings.ANTHROPIC_API_KEY), limit=limit, used=used, remaining=max(limit - used, 0)
    )


def _group_by_category(items: list[ReceiptItemRead]) -> list[ReceiptGroup]:
    groups: dict[int | None, ReceiptGroup] = {}
    for item in items:
        group = groups.setdefault(item.category_id, ReceiptGroup(category_id=item.category_id, amount=0, item_count=0))
        group.amount = round(group.amount + item.amount, 2)
        group.item_count += 1
    # Los grupos más grandes primero; los que quedaron en cero (p. ej. un descuento que anula un ítem) se omiten.
    return sorted((g for g in groups.values() if g.amount != 0), key=lambda g: g.amount, reverse=True)


@router.get("/quota", response_model=ReceiptQuota)
def get_quota(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _quota(db, current_user)


@router.post("/scan", response_model=ReceiptScanResult)
def scan_receipt(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if image.content_type not in SUPPORTED_MEDIA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Sube una foto en formato JPG, PNG o WEBP"
        )
    # Endpoint síncrono a propósito: FastAPI lo corre en un hilo, así la llamada al modelo no bloquea el servidor.
    data = image.file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="La imagen está vacía")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="La imagen pesa más de 5 MB")

    quota = _quota(db, current_user)
    if not quota.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El escaneo de boletas no está configurado en este servidor.",
        )
    if quota.remaining == 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Llegaste al límite de {quota.limit} escaneos en 24 horas. Puedes registrar el gasto a mano.",
        )

    categories = db.execute(
        select(Category.id, Category.name)
        .where(Category.owner_id == current_user.id, Category.type == TransactionType.EXPENSE)
        .order_by(Category.name)
    ).all()
    valid_ids = {c.id for c in categories}

    # Cada intento cuenta para el límite, porque la llamada al modelo tiene costo aunque la boleta no se lea.
    db.add(ReceiptScan(user_id=current_user.id))
    db.commit()

    try:
        extraction = extract_receipt(data, image.content_type, [(c.id, c.name) for c in categories])
    except ReceiptServiceUnavailable as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    except ReceiptScanError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e

    if not extraction.is_receipt or not extraction.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No encontramos una boleta en la foto. Intenta con más luz y la boleta completa.",
        )

    # Nunca se confía en un id que venga del modelo: si no es una categoría de gasto de esta persona, queda sin categoría.
    items = [
        ReceiptItemRead(
            description=item.description.strip() or "Ítem",
            amount=round(item.amount, 2),
            category_id=item.category_id if item.category_id in valid_ids else None,
        )
        for item in extraction.items
    ]

    return ReceiptScanResult(
        merchant=extraction.merchant,
        date=parse_receipt_date(extraction.date),
        currency=extraction.currency.upper() or "CLP",
        total=extraction.total,
        items=items,
        groups=_group_by_category(items),
        items_total=round(sum(i.amount for i in items), 2),
        quota=_quota(db, current_user),
    )
