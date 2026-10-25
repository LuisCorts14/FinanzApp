from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.institutions import get_product
from app.db.session import get_db
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountRead, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _get_owned_account_or_404(db: Session, account_id: int, user: User) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
def create_account(
    account_in: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = account_in.model_dump()
    if data["institution_id"] or data["product_id"]:
        product = get_product(data["institution_id"] or "", data["product_id"] or "")
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Institución o producto no válido",
            )
        # El producto del catálogo manda: así el tipo y la moneda no pueden contradecirlo.
        data["type"] = product.account_type
        data["currency"] = product.currency

    account = Account(**data, owner_id=current_user.id)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("", response_model=list[AccountRead])
def list_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(Account).where(Account.owner_id == current_user.id).order_by(Account.id)
    return db.scalars(stmt).all()


@router.get("/{account_id}", response_model=AccountRead)
def get_account(
    account_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return _get_owned_account_or_404(db, account_id, current_user)


@router.patch("/{account_id}", response_model=AccountRead)
def update_account(
    account_id: int,
    account_in: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _get_owned_account_or_404(db, account_id, current_user)

    for field, value in account_in.model_dump(exclude_unset=True).items():
        setattr(account, field, value)

    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    account = _get_owned_account_or_404(db, account_id, current_user)
    db.delete(account)
    db.commit()
