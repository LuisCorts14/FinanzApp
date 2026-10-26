"""Crea (o reinicia) la cuenta demo pública con 6 meses de datos realistas.

Uso:
    python scripts/demo_account.py            # usa DEMO_EMAIL de la configuración
    python scripts/demo_account.py demo@...   # o un email explícito

Si ya existe un usuario con ese email, solo se reemplaza cuando está marcado como demo
(`is_demo`): nunca borra una cuenta real.
"""

import random
import secrets
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal

sys.path.insert(0, ".")

from app.core.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.account import Account  # noqa: E402
from app.models.category import Category  # noqa: E402
from app.models.debt import Debt  # noqa: E402
from app.models.enums import AccountType, DebtKind, TransactionType  # noqa: E402
from app.models.savings_contribution import SavingsContribution  # noqa: E402
from app.models.savings_goal import SavingsGoal  # noqa: E402
from app.models.transaction import Transaction  # noqa: E402
from app.models.transfer import Transfer  # noqa: E402
from app.models.user import User  # noqa: E402

MONTHS = 6

# nombre: (presupuesto mensual, cuenta "rut"/"card"/"cash", [(descripción, mínimo, máximo, veces al mes)])
EXPENSES = {
    "Comida": (200000, "rut", [("Supermercado Lider", 25000, 60000, 3), ("Feria", 8000, 15000, 2), ("Almuerzo", 4500, 9000, 4)]),
    "Transporte": (60000, "cash", [("Carga Bip!", 10000, 15000, 2), ("Uber", 4000, 9000, 2)]),
    "Vivienda": (320000, "rut", [("Arriendo", 300000, 300000, 1)]),
    "Servicios": (70000, "rut", [("Luz", 18000, 30000, 1), ("Agua", 9000, 14000, 1), ("Internet y celular", 27990, 27990, 1)]),
    "Entretenimiento": (45000, "card", [("Netflix", 7990, 7990, 1), ("Spotify", 4950, 4950, 1), ("Salida con amigos", 12000, 25000, 1)]),
    "Salud": (None, "rut", [("Farmacia", 5000, 18000, 1)]),
    "Compras": (None, "card", [("Ropa", 15000, 45000, 1), ("Mercado Libre", 9000, 30000, 1)]),
}


def month_first(today: date, months_ago: int) -> date:
    year, month = today.year, today.month - months_ago
    while month <= 0:
        month, year = month + 12, year - 1
    return date(year, month, 1)


def random_day(first: date, today: date) -> date:
    next_month = date(first.year + (first.month == 12), first.month % 12 + 1, 1)
    last = min(next_month - timedelta(days=1), today)
    return first + timedelta(days=random.randint(0, (last - first).days))


def main() -> None:
    email = sys.argv[1] if len(sys.argv) > 1 else settings.DEMO_EMAIL
    if not email:
        sys.exit("Falta el email: define DEMO_EMAIL o pásalo como argumento.")

    random.seed(2026)
    today = date.today()
    start = month_first(today, MONTHS - 1)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing is not None:
            if not existing.is_demo:
                sys.exit(f"'{email}' es una cuenta real (no demo). No se tocó nada.")
            db.delete(existing)  # cascada: borra todos sus datos
            db.flush()

        user = User(
            email=email,
            full_name="Camila Rojas",
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # nadie entra con contraseña
            is_demo=True,
            payday=5,
            savings_target_pct=20,
            budget_alert_pct=80,
        )
        db.add(user)
        db.flush()

        def account(name, type_, balance, institution=None, product=None, **extra):
            acc = Account(
                owner_id=user.id, name=name, type=type_, balance=Decimal(balance), currency="CLP",
                institution_id=institution, product_id=product, **extra,
            )
            db.add(acc)
            return acc

        rut = account("CuentaRUT", AccountType.BANK, 180000, "bancoestado", "cuentarut")
        card = account("Tarjeta CMR", AccountType.CREDIT_CARD, -95000, "banco_falabella", "tarjeta_cmr", credit_limit=Decimal(600000), interest_rate=Decimal("2.9"), minimum_payment=Decimal(25000))
        cash = account("Efectivo", AccountType.CASH, 20000)
        savings = account("Ahorro viaje", AccountType.SAVINGS, 150000, "bancoestado", "cuenta_ahorro")
        db.flush()
        accounts = {"rut": rut, "card": card, "cash": cash}

        salary = Category(owner_id=user.id, name="Sueldo", type=TransactionType.INCOME)
        extra_income = Category(owner_id=user.id, name="Trabajos extra", type=TransactionType.INCOME)
        db.add_all([salary, extra_income])
        categories = {}
        for name, (budget, _, _) in EXPENSES.items():
            categories[name] = Category(
                owner_id=user.id, name=name, type=TransactionType.EXPENSE,
                monthly_budget=Decimal(budget) if budget else None,
            )
            db.add(categories[name])
        db.flush()

        def tx(acc, category, amount, day, description):
            db.add(Transaction(account_id=acc.id, category_id=category.id, amount=Decimal(amount), date=day, description=description))
            sign = 1 if category.type == TransactionType.INCOME else -1
            acc.balance += sign * Decimal(amount)

        def transfer(source, target, amount, day, description):
            db.add(Transfer(
                from_account_id=source.id, to_account_id=target.id, amount=Decimal(amount),
                to_amount=Decimal(amount), date=day, description=description,
            ))
            source.balance -= Decimal(amount)
            target.balance += Decimal(amount)

        card_spent_last_month = 95000
        for months_ago in range(MONTHS - 1, -1, -1):
            first = month_first(today, months_ago)
            payday = first + timedelta(days=4)
            if payday > today:
                break
            tx(rut, salary, random.randint(85, 95) * 10000, payday, "Sueldo")
            if random.random() < 0.5:
                tx(rut, extra_income, random.randint(6, 15) * 10000, random_day(first, today), "Clases particulares")

            # Pagar la tarjeta del mes anterior, ahorrar y sacar efectivo: transferencias, no gastos.
            transfer(rut, card, card_spent_last_month, min(payday + timedelta(days=1), today), "Pago tarjeta CMR")
            transfer(rut, savings, 60000, min(payday + timedelta(days=1), today), "Ahorro del mes")
            transfer(rut, cash, 40000, min(payday + timedelta(days=2), today), "Giro cajero")

            card_spent = 0
            for name, (_, where, items) in EXPENSES.items():
                for description, low, high, times in items:
                    for _ in range(times):
                        amount = random.randint(low // 10, high // 10) * 10
                        tx(accounts[where], categories[name], amount, random_day(first, today), description)
                        if where == "card":
                            card_spent += amount
            card_spent_last_month = card_spent

        goal_created = datetime.combine(start, datetime.min.time())
        emergency = SavingsGoal(
            owner_id=user.id, name="Fondo de emergencia", target_amount=Decimal(1500000),
            target_date=today.replace(year=today.year + 1), created_at=goal_created,
        )
        trip = SavingsGoal(
            owner_id=user.id, account_id=savings.id, name="Viaje al sur", target_amount=Decimal(600000),
            target_date=today + timedelta(days=120), created_at=goal_created,
        )
        db.add_all([emergency, trip])
        db.flush()
        for months_ago in range(MONTHS - 1, -1, -1):
            day = month_first(today, months_ago) + timedelta(days=6)
            if day <= today:
                db.add(SavingsContribution(goal_id=emergency.id, amount=Decimal(random.choice([70000, 90000, 110000])), date=day, note="Abono mensual"))
        db.add(SavingsContribution(goal_id=emergency.id, amount=Decimal(-35000), date=month_first(today, 2) + timedelta(days=18), note="Arreglo del celular"))

        # Plan de deudas: un crédito de consumo y un avance, además de la tarjeta.
        db.add_all([
            Debt(owner_id=user.id, name="Crédito de consumo BancoEstado", kind=DebtKind.CONSUMER_LOAN.value,
                 balance=Decimal(1350000), interest_rate=Decimal("1.6"), minimum_payment=Decimal(68000)),
            Debt(owner_id=user.id, name="Avance en efectivo", kind=DebtKind.CASH_ADVANCE.value,
                 balance=Decimal(220000), interest_rate=Decimal("3.4"), minimum_payment=Decimal(30000)),
        ])
        user.debt_monthly_budget = Decimal(180000)

        user.default_account_id = rut.id
        db.commit()
        print(f"Cuenta demo lista: {email} (id={user.id})")
        print(f"Saldos: CuentaRUT {rut.balance}, Tarjeta CMR {card.balance}, Efectivo {cash.balance}, Ahorro {savings.balance}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
