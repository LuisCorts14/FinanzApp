from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.dateutils import month_range
from app.db.session import get_db
from app.models.account import Account
from app.models.transfer import Transfer
from app.models.user import User
from app.schemas.transfer import TransferCreate, TransferRead, TransferUpdate
from app.services.balances import adjust_balance

router = APIRouter(prefix="/transfers", tags=["transfers"])


def _get_owned_account_or_404(db: Session, account_id: int, user: User) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def _get_owned_transfer_or_404(db: Session, transfer_id: int, user: User) -> Transfer:
    transfer = db.get(Transfer, transfer_id)
    if transfer is None or transfer.from_account.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")
    return transfer


def _resolve_to_amount(source: Account, target: Account, amount: float, to_amount: float | None) -> float:
    if source.currency == target.currency:
        return amount
    if to_amount is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Las cuentas tienen distinta moneda: indica cuánto llega en {target.currency}",
        )
    return to_amount


def _apply(db: Session, transfer: Transfer, sign: int) -> None:
    """sign=1 aplica la transferencia a los saldos; sign=-1 la revierte."""
    adjust_balance(db, transfer.from_account_id, -sign * Decimal(str(transfer.amount)))
    adjust_balance(db, transfer.to_account_id, sign * Decimal(str(transfer.to_amount)))


@router.post("", response_model=TransferRead, status_code=status.HTTP_201_CREATED)
def create_transfer(
    transfer_in: TransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if transfer_in.from_account_id == transfer_in.to_account_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Elige dos cuentas distintas"
        )
    source = _get_owned_account_or_404(db, transfer_in.from_account_id, current_user)
    target = _get_owned_account_or_404(db, transfer_in.to_account_id, current_user)

    data = transfer_in.model_dump()
    data["to_amount"] = _resolve_to_amount(source, target, data["amount"], data["to_amount"])
    transfer = Transfer(**data)
    transfer.from_account, transfer.to_account = source, target
    _apply(db, transfer, 1)

    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer


@router.get("", response_model=list[TransferRead])
def list_transfers(
    account_id: int | None = None,
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Transfer)
        .join(Account, Transfer.from_account_id == Account.id)
        .where(Account.owner_id == current_user.id)
        .order_by(Transfer.date.desc(), Transfer.id.desc())
    )
    if account_id is not None:
        stmt = stmt.where(or_(Transfer.from_account_id == account_id, Transfer.to_account_id == account_id))
    if month is not None:
        start, end = month_range(month)
        stmt = stmt.where(Transfer.date >= start, Transfer.date < end)
    return db.scalars(stmt).all()


@router.patch("/{transfer_id}", response_model=TransferRead)
def update_transfer(
    transfer_id: int,
    transfer_in: TransferUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transfer = _get_owned_transfer_or_404(db, transfer_id, current_user)
    _apply(db, transfer, -1)

    data = transfer_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(transfer, field, value)
    if "amount" in data or "to_amount" in data:
        requested = data["to_amount"] if "to_amount" in data else float(transfer.to_amount)
        transfer.to_amount = _resolve_to_amount(
            transfer.from_account, transfer.to_account, float(transfer.amount), requested
        )

    _apply(db, transfer, 1)
    db.commit()
    db.refresh(transfer)
    return transfer


@router.delete("/{transfer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transfer(
    transfer_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    transfer = _get_owned_transfer_or_404(db, transfer_id, current_user)
    _apply(db, transfer, -1)
    db.delete(transfer)
    db.commit()
