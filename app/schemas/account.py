from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import AccountType


class AccountBase(BaseModel):
    name: str
    type: AccountType
    currency: str = "CLP"


class AccountCreate(AccountBase):
    balance: float = 0
    institution_id: str | None = None
    product_id: str | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    type: AccountType | None = None
    currency: str | None = None


class AccountRead(AccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    institution_id: str | None
    product_id: str | None
    institution_name: str | None
    product_name: str | None
    balance: float
    balance_base: float
    created_at: datetime
