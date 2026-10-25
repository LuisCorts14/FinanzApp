from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.dateutils import month_range
from app.db.session import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.enums import TransactionType
from app.models.transaction import Transaction
from app.models.user import User
from app.services.balances import adjust_balance
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _signed_amount(type_: TransactionType, amount) -> Decimal:
    value = Decimal(str(amount))
    return value if type_ == TransactionType.INCOME else -value


def _get_owned_account_or_404(db: Session, account_id: int, user: User) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def _get_owned_category_or_404(db: Session, category_id: int, user: User) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


def _get_owned_transaction_or_404(db: Session, transaction_id: int, user: User) -> Transaction:
    transaction = db.get(Transaction, transaction_id)
    if transaction is None or transaction.account.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return transaction


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(
    transaction_in: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _get_owned_account_or_404(db, transaction_in.account_id, current_user)
    category = _get_owned_category_or_404(db, transaction_in.category_id, current_user)

    transaction = Transaction(**transaction_in.model_dump())
    adjust_balance(db, account.id, _signed_amount(category.type, transaction.amount))

    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    account_id: int | None = None,
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Account.owner_id == current_user.id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
    )
    if account_id is not None:
        stmt = stmt.where(Transaction.account_id == account_id)
    if month is not None:
        start, end = month_range(month)
        stmt = stmt.where(Transaction.date >= start, Transaction.date < end)
    return db.scalars(stmt).all()


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(
    transaction_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return _get_owned_transaction_or_404(db, transaction_id, current_user)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    transaction_in: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction = _get_owned_transaction_or_404(db, transaction_id, current_user)

    old_category = db.get(Category, transaction.category_id)
    adjust_balance(db, transaction.account_id, -_signed_amount(old_category.type, transaction.amount))

    update_data = transaction_in.model_dump(exclude_unset=True)
    new_category = (
        _get_owned_category_or_404(db, update_data["category_id"], current_user)
        if "category_id" in update_data
        else old_category
    )

    for field, value in update_data.items():
        setattr(transaction, field, value)

    adjust_balance(db, transaction.account_id, _signed_amount(new_category.type, transaction.amount))

    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    transaction = _get_owned_transaction_or_404(db, transaction_id, current_user)

    category = db.get(Category, transaction.category_id)
    adjust_balance(db, transaction.account_id, -_signed_amount(category.type, transaction.amount))

    db.delete(transaction)
    db.commit()
