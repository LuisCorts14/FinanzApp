from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import TransactionType


class CategoryBase(BaseModel):
    name: str
    type: TransactionType
    monthly_budget: float | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    type: TransactionType | None = None
    monthly_budget: float | None = None


class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
