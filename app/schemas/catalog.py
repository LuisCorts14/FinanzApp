from pydantic import BaseModel

from app.models.enums import AccountType


class ProductRead(BaseModel):
    id: str
    name: str
    account_type: AccountType
    currency: str


class InstitutionRead(BaseModel):
    id: str
    name: str
    group: str
    color: str
    products: list[ProductRead]
