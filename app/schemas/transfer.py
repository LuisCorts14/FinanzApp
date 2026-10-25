from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TransferCreate(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: float = Field(..., gt=0)
    # Solo necesario si las cuentas tienen distinta moneda.
    to_amount: float | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, max_length=255)
    date: date_type


class TransferUpdate(BaseModel):
    """Las cuentas de una transferencia no se cambian: se borra y se crea otra."""

    amount: float | None = Field(default=None, gt=0)
    to_amount: float | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, max_length=255)
    date: date_type | None = None


class TransferRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    from_account_id: int
    to_account_id: int
    amount: float
    to_amount: float
    description: str | None
    date: date_type
    created_at: datetime
