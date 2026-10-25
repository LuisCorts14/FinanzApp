from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AccountType


class AccountBase(BaseModel):
    name: str
    type: AccountType
    currency: str = "CLP"


class AccountCreate(AccountBase):
    balance: float = 0
    institution_id: str | None = None
    product_id: str | None = None
    credit_limit: float | None = Field(default=None, gt=0)


class AccountUpdate(BaseModel):
    """El saldo no se edita: solo cambia a través de los movimientos."""

    name: str | None = None
    type: AccountType | None = None
    currency: str | None = None
    institution_id: str | None = None
    product_id: str | None = None
    credit_limit: float | None = Field(default=None, gt=0)


class AccountRead(AccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    institution_id: str | None
    product_id: str | None
    institution_name: str | None
    product_name: str | None
    credit_limit: float | None
    balance: float
    balance_base: float
    created_at: datetime
