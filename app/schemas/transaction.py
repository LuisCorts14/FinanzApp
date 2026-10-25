from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.category import CategoryRead


class TransactionBase(BaseModel):
    account_id: int
    category_id: int
    amount: float
    description: str | None = None
    date: date_type


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    category_id: int | None = None
    amount: float | None = None
    description: str | None = None
    date: date_type | None = None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    category: CategoryRead
    amount: float
    description: str | None
    date: date_type
    created_at: datetime
