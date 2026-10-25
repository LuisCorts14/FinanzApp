from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.account import AccountRead


class SavingsGoalCreate(BaseModel):
    account_id: int | None = None
    name: str
    target_amount: float
    target_date: date_type


class SavingsGoalUpdate(BaseModel):
    name: str | None = None
    target_amount: float | None = None
    target_date: date_type | None = None


class SavingsContributionCreate(BaseModel):
    amount: float = Field(..., description="Positivo para abonar, negativo para retirar")
    date: date_type
    note: str | None = Field(default=None, max_length=200)


class SavingsContributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    date: date_type
    note: str | None
    created_at: datetime


class SavingsGoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    target_amount: float
    target_date: date_type
    account: AccountRead | None
    current_amount: float
    start_amount: float
    created_at: datetime
