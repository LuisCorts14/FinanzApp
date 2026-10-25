import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.enums import TransactionType
from app.models.transaction import Transaction
from app.models.transfer import Transfer
from app.models.user import User
from app.schemas.settings import UserSettings, UserSettingsUpdate

router = APIRouter(tags=["settings"])


def _owned_account(db: Session, account_id: int | None, user: User) -> Account | None:
    if account_id is None:
        return None
    account = db.get(Account, account_id)
    return account if account is not None and account.owner_id == user.id else None


def _read(db: Session, user: User) -> UserSettings:
    account = _owned_account(db, user.default_account_id, user)
    return UserSettings(
        payday=user.payday,
        savings_target_pct=user.savings_target_pct,
        budget_alert_pct=user.budget_alert_pct,
        default_account_id=account.id if account else None,
    )


@router.get("/settings", response_model=UserSettings)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _read(db, current_user)


@router.patch("/settings", response_model=UserSettings)
def update_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump(exclude_unset=True)
    if data.get("default_account_id") is not None and _owned_account(db, data["default_account_id"], current_user) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    # Estos dos siempre tienen un valor: null no significa "sin valor", así que se ignora.
    for field in ("savings_target_pct", "budget_alert_pct"):
        if field in data and data[field] is None:
            del data[field]
    for field, value in data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return _read(db, current_user)


@router.get("/export/movements.csv")
def export_movements(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Todas las transacciones y transferencias de la persona, en un CSV que abre bien en Excel."""
    accounts = {a.id: a for a in db.scalars(select(Account).where(Account.owner_id == current_user.id))}
    account_ids = list(accounts)
    rows: list[tuple[date, list]] = []

    transactions = db.scalars(select(Transaction).where(Transaction.account_id.in_(account_ids)))
    for t in transactions:
        account = accounts[t.account_id]
        is_income = t.category.type == TransactionType.INCOME
        rows.append((t.date, [
            t.date.isoformat(),
            "Ingreso" if is_income else "Gasto",
            t.description or "",
            t.category.name,
            account.name,
            "",
            f"{float(t.amount) if is_income else -float(t.amount):.2f}",
            account.currency,
        ]))

    transfers = db.scalars(
        select(Transfer).where(or_(Transfer.from_account_id.in_(account_ids), Transfer.to_account_id.in_(account_ids)))
    )
    for t in transfers:
        rows.append((t.date, [
            t.date.isoformat(),
            "Transferencia",
            t.description or "",
            "",
            accounts[t.from_account_id].name,
            accounts[t.to_account_id].name,
            f"{float(t.amount):.2f}",
            accounts[t.from_account_id].currency,
        ]))

    rows.sort(key=lambda r: r[0], reverse=True)
    buffer = io.StringIO()
    # BOM + punto y coma: Excel en español los abre bien con tildes y en columnas separadas.
    buffer.write("\ufeff")
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(["Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Cuenta destino", "Monto", "Moneda"])
    writer.writerows(r[1] for r in rows)

    filename = f"finanzapp-movimientos-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
