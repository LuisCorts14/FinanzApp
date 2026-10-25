from datetime import date as date_type

from pydantic import BaseModel


class ReceiptQuota(BaseModel):
    enabled: bool
    limit: int
    used: int
    remaining: int


class ReceiptItemRead(BaseModel):
    description: str
    amount: float
    category_id: int | None


class ReceiptGroup(BaseModel):
    """Suma de los ítems de una misma categoría: se propone como un gasto."""

    category_id: int | None
    amount: float
    item_count: int


class ReceiptScanResult(BaseModel):
    merchant: str | None
    date: date_type | None
    currency: str
    total: float | None
    items: list[ReceiptItemRead]
    groups: list[ReceiptGroup]
    items_total: float
    quota: ReceiptQuota
