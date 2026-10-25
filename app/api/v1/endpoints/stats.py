from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.currency import get_exchange_rate
from app.core.dateutils import month_range
from app.db.session import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.enums import TransactionType
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.stats import BudgetStatus, CategoryTotal, MonthlySummary, WeeklySummary
from app.services.budgets import budget_statuses

router = APIRouter(prefix="/stats", tags=["stats"])


def _to_base(amount, currency: str) -> float:
    return float(amount) * get_exchange_rate(currency)


def _current_month() -> str:
    today = date.today()
    return f"{today.year:04d}-{today.month:02d}"


@router.get("/expenses-by-category", response_model=list[CategoryTotal])
def expenses_by_category(
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Category.id, Category.name, Transaction.amount, Account.currency)
        .join(Transaction, Transaction.category_id == Category.id)
        .join(Account, Transaction.account_id == Account.id)
        .where(Category.type == TransactionType.EXPENSE, Account.owner_id == current_user.id)
    )
    if month is not None:
        start, end = month_range(month)
        stmt = stmt.where(Transaction.date >= start, Transaction.date < end)
    rows = db.execute(stmt).all()

    totals: dict[int, dict] = {}
    for category_id, category_name, amount, currency in rows:
        entry = totals.setdefault(category_id, {"name": category_name, "total": 0.0})
        entry["total"] += _to_base(amount, currency)

    results = [
        CategoryTotal(category_id=cid, category_name=v["name"], total=round(v["total"], 2))
        for cid, v in totals.items()
    ]
    results.sort(key=lambda r: r.total, reverse=True)
    return results


@router.get("/monthly-summary", response_model=list[MonthlySummary])
def monthly_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = (
        select(Transaction.date, Category.type, Transaction.amount, Account.currency)
        .join(Category, Transaction.category_id == Category.id)
        .join(Account, Transaction.account_id == Account.id)
        .where(Account.owner_id == current_user.id)
    )
    rows = db.execute(stmt).all()

    totals: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for tx_date, type_, amount, currency in rows:
        month = tx_date.strftime("%Y-%m")
        totals[month][type_.value] += _to_base(amount, currency)

    return [
        MonthlySummary(month=month, income=round(values["income"], 2), expense=round(values["expense"], 2))
        for month, values in sorted(totals.items())
    ]


@router.get("/budgets", response_model=list[BudgetStatus])
def budget_status(
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return budget_statuses(db, current_user, month or _current_month())


@router.get("/weekly-summary", response_model=list[WeeklySummary])
def weekly_summary(
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ingresos y gastos del mes en 4 bloques: dias 1-7, 8-14, 15-21 y 22 a fin de mes."""
    start, end = month_range(month or _current_month())
    last_day = (end - timedelta(days=1)).day

    stmt = (
        select(Transaction.date, Category.type, Transaction.amount, Account.currency)
        .join(Category, Transaction.category_id == Category.id)
        .join(Account, Transaction.account_id == Account.id)
        .where(Account.owner_id == current_user.id, Transaction.date >= start, Transaction.date < end)
    )

    weeks = [{"income": 0.0, "expense": 0.0} for _ in range(4)]
    for tx_date, type_, amount, currency in db.execute(stmt).all():
        index = min((tx_date.day - 1) // 7, 3)
        weeks[index][type_.value] += _to_base(amount, currency)

    return [
        WeeklySummary(
            week=i + 1,
            start_day=i * 7 + 1,
            end_day=last_day if i == 3 else (i + 1) * 7,
            income=round(values["income"], 2),
            expense=round(values["expense"], 2),
        )
        for i, values in enumerate(weeks)
    ]
