"""Siembra datos de demo (cuenta, categorias, movimientos) para un usuario ya existente.

Uso:
    python scripts/seed_demo_data.py usuario@ejemplo.com

No crea usuarios ni toca datos de otros usuarios: todo queda scoped al email
que le pases. Reutiliza cuentas/categorias existentes por nombre en vez de
duplicarlas.
"""

import random
import sys
from datetime import date, timedelta
from decimal import Decimal

sys.path.insert(0, ".")

from app.db.session import SessionLocal  # noqa: E402
from app.models.account import Account  # noqa: E402
from app.models.category import Category  # noqa: E402
from app.models.enums import AccountType, TransactionType  # noqa: E402
from app.models.transaction import Transaction  # noqa: E402
from app.models.user import User  # noqa: E402

EXPENSE_CATEGORIES = {
    "Comida": (5000, 25000, 10, 16),
    "Transporte": (2000, 8000, 6, 12),
    "Vivienda": (250000, 320000, 1, 1),
    "Servicios": (30000, 60000, 1, 1),
    "Entretenimiento": (5000, 30000, 1, 3),
    "Compras": (10000, 80000, 0, 2),
}
INCOME_CATEGORY = "Sueldo"
MONTHS_BACK = 5


def get_or_create_category(db, owner_id: int, name: str, type_: TransactionType) -> Category:
    category = (
        db.query(Category).filter(Category.owner_id == owner_id, Category.name == name).first()
    )
    if category is not None:
        return category
    category = Category(owner_id=owner_id, name=name, type=type_)
    db.add(category)
    db.flush()
    return category


def get_or_create_account(db, owner_id: int) -> Account:
    account = db.query(Account).filter(Account.owner_id == owner_id).first()
    if account is not None:
        return account
    account = Account(owner_id=owner_id, name="Cuenta Principal", type=AccountType.BANK, balance=0, currency="CLP")
    db.add(account)
    db.flush()
    return account


def month_start(base: date, months_ago: int) -> date:
    month = base.month - months_ago
    year = base.year
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


def random_day_in_month(month_first_day: date, until: date | None = None) -> date:
    if month_first_day.month == 12:
        next_month = date(month_first_day.year + 1, 1, 1)
    else:
        next_month = date(month_first_day.year, month_first_day.month + 1, 1)
    last_day = next_month - timedelta(days=1)
    if until is not None:
        last_day = min(last_day, until)
    return month_first_day + timedelta(days=random.randint(0, (last_day - month_first_day).days))


def main():
    if len(sys.argv) != 2:
        print("Uso: python scripts/seed_demo_data.py usuario@ejemplo.com")
        sys.exit(1)

    email = sys.argv[1]
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            print(f"No existe ningun usuario con email '{email}'. No se creo nada.")
            sys.exit(1)

        income_category = get_or_create_category(db, user.id, INCOME_CATEGORY, TransactionType.INCOME)
        expense_categories = {
            name: get_or_create_category(db, user.id, name, TransactionType.EXPENSE)
            for name in EXPENSE_CATEGORIES
        }
        account = get_or_create_account(db, user.id)

        today = date.today()
        total_income = Decimal("0")
        total_expense = Decimal("0")
        transactions_created = 0

        for months_ago in range(MONTHS_BACK, -1, -1):
            first_day = month_start(today, months_ago)

            salary_day = min(first_day + timedelta(days=4), today)
            salary_amount = Decimal(random.randint(700_000, 950_000))
            db.add(
                Transaction(
                    account_id=account.id,
                    category_id=income_category.id,
                    amount=salary_amount,
                    date=salary_day,
                    description="Sueldo mensual",
                )
            )
            total_income += salary_amount
            transactions_created += 1

            for name, (low, high, min_count, max_count) in EXPENSE_CATEGORIES.items():
                count = random.randint(min_count, max_count)
                for _ in range(count):
                    amount = Decimal(random.randint(low, high))
                    db.add(
                        Transaction(
                            account_id=account.id,
                            category_id=expense_categories[name].id,
                            amount=amount,
                            date=random_day_in_month(first_day, until=today),
                        )
                    )
                    total_expense += amount
                    transactions_created += 1

        account.balance = Decimal(str(account.balance)) + total_income - total_expense
        db.commit()

        print(f"Usuario: {email}")
        print(f"Cuenta usada: '{account.name}' (id={account.id})")
        print(f"Categorias: {INCOME_CATEGORY} + {', '.join(EXPENSE_CATEGORIES)}")
        print(f"Movimientos creados: {transactions_created} (ultimos {MONTHS_BACK + 1} meses)")
        print(f"Ingresos sembrados: {total_income}")
        print(f"Gastos sembrados: {total_expense}")
        print(f"Balance final de la cuenta: {account.balance}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
