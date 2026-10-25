from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.currency import get_exchange_rate
from app.core.dateutils import month_range
from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.stats import BudgetStatus


def budget_statuses(db: Session, user: User, month: str) -> list[BudgetStatus]:
    """Cuánto se gastó en el mes (en CLP) en cada categoría que tiene presupuesto."""
    start, end = month_range(month)

    spent_stmt = (
        select(Transaction.category_id, Transaction.amount, Account.currency)
        .join(Account, Transaction.account_id == Account.id)
        .where(Account.owner_id == user.id, Transaction.date >= start, Transaction.date < end)
    )
    spent_by_category: dict[int, float] = defaultdict(float)
    for category_id, amount, currency in db.execute(spent_stmt).all():
        spent_by_category[category_id] += float(amount) * get_exchange_rate(currency)

    categories_stmt = (
        select(Category.id, Category.name, Category.monthly_budget)
        .where(Category.owner_id == user.id, Category.monthly_budget.isnot(None))
        .order_by(Category.name)
    )
    return [
        BudgetStatus(
            category_id=row.id,
            category_name=row.name,
            monthly_budget=float(row.monthly_budget),
            spent=round(spent_by_category.get(row.id, 0.0), 2),
        )
        for row in db.execute(categories_stmt).all()
    ]
