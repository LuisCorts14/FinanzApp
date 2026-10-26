from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.currency import get_exchange_rate
from app.db.session import get_db
from app.models.account import Account
from app.models.debt import Debt
from app.models.enums import AccountType
from app.models.user import User
from app.schemas.debt import (
    DebtCreate,
    DebtPaymentCreate,
    DebtPlan,
    DebtPlanSettings,
    DebtRead,
    DebtUpdate,
    PlanDebt,
)
from app.services import debt_plan

router = APIRouter(prefix="/debts", tags=["debts"])


def _get_owned_debt_or_404(db: Session, debt_id: int, user: User) -> Debt:
    debt = db.get(Debt, debt_id)
    if debt is None or debt.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debt not found")
    return debt


@router.get("", response_model=list[DebtRead])
def list_debts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.scalars(select(Debt).where(Debt.owner_id == current_user.id).order_by(Debt.id)).all()


@router.post("", response_model=DebtRead, status_code=status.HTTP_201_CREATED)
def create_debt(debt_in: DebtCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    debt = Debt(**debt_in.model_dump(mode="json"), owner_id=current_user.id)
    db.add(debt)
    db.commit()
    db.refresh(debt)
    return debt


@router.patch("/{debt_id}", response_model=DebtRead)
def update_debt(
    debt_id: int,
    debt_in: DebtUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debt = _get_owned_debt_or_404(db, debt_id, current_user)
    for field, value in debt_in.model_dump(mode="json", exclude_unset=True).items():
        if value is not None:
            setattr(debt, field, value)
    db.commit()
    db.refresh(debt)
    return debt


@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_debt(debt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.delete(_get_owned_debt_or_404(db, debt_id, current_user))
    db.commit()


@router.post("/{debt_id}/payments", response_model=DebtRead)
def register_payment(
    debt_id: int,
    payment: DebtPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Descuenta un pago del saldo (sin bajar de 0). El saldo se ajusta en SQL para no perder pagos simultáneos."""
    debt = _get_owned_debt_or_404(db, debt_id, current_user)
    db.execute(
        update(Debt)
        .where(Debt.id == debt.id)
        .values(balance=func.greatest(Debt.balance - payment.amount, 0))
        .execution_options(synchronize_session=False)
    )
    db.commit()
    db.refresh(debt)
    return debt


@router.put("/plan-settings", response_model=DebtPlanSettings)
def save_plan_settings(
    settings_in: DebtPlanSettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.debt_monthly_budget = settings_in.monthly_budget
    current_user.debt_strategy = settings_in.strategy
    db.commit()
    return settings_in


def _plan_debts(db: Session, user: User) -> list[PlanDebt]:
    items: list[PlanDebt] = []
    cards = db.scalars(
        select(Account)
        .where(Account.owner_id == user.id, Account.type == AccountType.CREDIT_CARD, Account.balance < 0)
        .order_by(Account.id)
    )
    for card in cards:
        rate = get_exchange_rate(card.currency)
        balance = round(-float(card.balance) * rate, 2)
        interest = float(card.interest_rate) if card.interest_rate is not None else None
        minimum = round(float(card.minimum_payment) * rate, 2) if card.minimum_payment is not None else None
        items.append(
            PlanDebt(
                key=f"card-{card.id}",
                source="card",
                id=card.id,
                name=card.name,
                kind="credit_card",
                balance=balance,
                interest_rate=interest,
                minimum_payment=minimum,
                monthly_interest=round(balance * (interest or 0) / 100),
                included=interest is not None and minimum is not None,
            )
        )
    for debt in db.scalars(select(Debt).where(Debt.owner_id == user.id, Debt.balance > 0).order_by(Debt.id)):
        balance = float(debt.balance)
        items.append(
            PlanDebt(
                key=f"debt-{debt.id}",
                source="debt",
                id=debt.id,
                name=debt.name,
                kind=debt.kind,
                balance=balance,
                interest_rate=float(debt.interest_rate),
                minimum_payment=float(debt.minimum_payment),
                monthly_interest=round(balance * float(debt.interest_rate) / 100),
                included=True,
            )
        )
    return items


@router.get("/plan", response_model=DebtPlan)
def get_plan(
    budget: float | None = Query(default=None, gt=0, description="Cuánto se puede pagar al mes; por defecto, lo guardado"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = _plan_debts(db, current_user)
    inputs = [
        debt_plan.DebtInput(d.key, d.name, d.balance, d.interest_rate or 0, d.minimum_payment or 0)
        for d in items
        if d.included
    ]
    total_minimum = round(sum(d.minimum_payment for d in inputs))
    saved = float(current_user.debt_monthly_budget) if current_user.debt_monthly_budget is not None else None
    monthly_budget = budget or saved or total_minimum

    def scenario(strategy):
        return asdict(debt_plan.simulate(inputs, monthly_budget, strategy))

    return DebtPlan(
        monthly_budget=monthly_budget,
        budget_is_saved=saved is not None,
        strategy=current_user.debt_strategy,
        total_balance=round(sum(d.balance for d in items)),
        total_minimum=total_minimum,
        monthly_interest=round(sum(d.monthly_interest for d in items)),
        debts=items,
        avalanche=scenario("avalanche"),
        snowball=scenario("snowball"),
        minimum_only=scenario(None),
    )
