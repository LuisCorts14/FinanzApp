"""Avisos calculados a partir de los datos actuales de la persona (no se guardan; solo se guarda cuáles leyó).

Cada aviso tiene una `key` estable que incluye su período (p. ej. el mes): así, marcar como leído
"Comida excedida en octubre" no oculta el mismo problema en noviembre.
"""

import calendar
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.currency import get_exchange_rate
from app.core.dateutils import month_range
from app.models.account import Account
from app.models.category import Category
from app.models.enums import AccountType, TransactionType
from app.models.savings_goal import SavingsGoal
from app.models.transaction import Transaction
from app.models.transfer import Transfer
from app.models.user import User
from app.schemas.notification import Notification
from app.services.budgets import budget_statuses

INACTIVITY_DAYS = 7
PAYDAY_NOTICE_DAYS = 2
CARD_WARNING_PCT = 80
SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2, "good": 3}


def _today() -> date:
    # Separado para que los tests puedan fijar la fecha.
    return date.today()


def _clp(value: float) -> str:
    return f"${round(value):,}".replace(",", ".")


def _next_payday(payday: int, today: date) -> date:
    """El día de pago de este mes si aún no llega; si no, el del mes siguiente (ajustado a meses cortos)."""

    def in_month(year: int, month: int) -> date:
        if month == 13:
            year, month = year + 1, 1
        return date(year, month, min(payday, calendar.monthrange(year, month)[1]))

    this_month = in_month(today.year, today.month)
    return this_month if this_month > today else in_month(today.year, today.month + 1)


def _month_totals(db: Session, user: User, month: str) -> tuple[float, float]:
    start, end = month_range(month)
    rows = db.execute(
        select(Category.type, Transaction.amount, Account.currency)
        .join(Category, Transaction.category_id == Category.id)
        .join(Account, Transaction.account_id == Account.id)
        .where(Account.owner_id == user.id, Transaction.date >= start, Transaction.date < end)
    ).all()
    income = sum(float(a) * get_exchange_rate(c) for t, a, c in rows if t == TransactionType.INCOME)
    expense = sum(float(a) * get_exchange_rate(c) for t, a, c in rows if t == TransactionType.EXPENSE)
    return income, expense


def _budget_notifications(db: Session, user: User, month: str) -> list[Notification]:
    items = []
    for b in budget_statuses(db, user, month):
        if b.monthly_budget <= 0:
            continue
        pct = b.spent / b.monthly_budget * 100
        if pct >= 100:
            items.append(Notification(
                key=f"budget_exceeded:{b.category_id}:{month}",
                kind="budget_exceeded",
                severity="critical",
                title=f"Te pasaste del presupuesto de {b.category_name}",
                message=f"Llevas {_clp(b.spent)} de {_clp(b.monthly_budget)} este mes ({_clp(b.spent - b.monthly_budget)} de más).",
                link="/categories",
            ))
        elif pct >= user.budget_alert_pct:
            items.append(Notification(
                key=f"budget_warning:{b.category_id}:{month}",
                kind="budget_warning",
                severity="warning",
                title=f"{b.category_name}: ya usaste el {round(pct)}% del presupuesto",
                message=f"Te quedan {_clp(b.monthly_budget - b.spent)} para lo que resta del mes.",
                link="/categories",
            ))
    return items


def _card_notifications(db: Session, user: User, month: str) -> list[Notification]:
    items = []
    cards = db.scalars(
        select(Account).where(
            Account.owner_id == user.id, Account.type == AccountType.CREDIT_CARD, Account.credit_limit.isnot(None)
        )
    )
    for card in cards:
        limit = float(card.credit_limit)
        used = max(-float(card.balance), 0)
        pct = used / limit * 100 if limit > 0 else 0
        if pct > 100:
            items.append(Notification(
                key=f"card_over:{card.id}:{month}",
                kind="card_over",
                severity="critical",
                title=f"Superaste el cupo de {card.name}",
                message=f"Debes {_clp(used)} y tu cupo es {_clp(limit)}. Evita usarla hasta pagar.",
                link=f"/accounts/{card.id}",
            ))
        elif pct >= CARD_WARNING_PCT:
            items.append(Notification(
                key=f"card_high:{card.id}:{month}",
                kind="card_high",
                severity="warning",
                title=f"{card.name}: usas el {round(pct)}% del cupo",
                message=f"Te quedan {_clp(limit - used)} disponibles. Lo recomendable es usar menos del 30%.",
                link=f"/accounts/{card.id}",
            ))
    return items


def _goal_notifications(db: Session, user: User, today: date, month: str) -> list[Notification]:
    items = []
    for goal in db.scalars(select(SavingsGoal).where(SavingsGoal.owner_id == user.id)):
        target = float(goal.target_amount)
        current = goal.current_amount
        if current >= target:
            items.append(Notification(
                key=f"goal_done:{goal.id}",
                kind="goal_done",
                severity="good",
                title=f"¡Cumpliste tu meta {goal.name}!",
                message=f"Juntaste {_clp(current)} de {_clp(target)}.",
                link=f"/ahorros/{goal.id}",
            ))
            continue
        if goal.target_date <= today:
            continue
        # Mismo plan lineal que muestra el detalle de la meta: desde lo que había al crearla hasta el objetivo.
        start = goal.created_at.date()
        total_days = max((goal.target_date - start).days, 1)
        elapsed = min(max((today - start).days, 0), total_days)
        base = min(goal.start_amount, target)
        expected = base + (target - base) * elapsed / total_days
        behind = expected - current
        if behind > target * 0.02:
            items.append(Notification(
                key=f"goal_behind:{goal.id}:{month}",
                kind="goal_behind",
                severity="warning",
                title=f"Tu meta {goal.name} va atrasada",
                message=f"Según el plan deberías llevar {_clp(expected)}; llevas {_clp(current)}. Abona {_clp(behind)} para ponerte al día.",
                link=f"/ahorros/{goal.id}",
            ))
    return items


def _last_activity(db: Session, user: User) -> datetime | None:
    my_accounts = select(Account.id).where(Account.owner_id == user.id)
    last_tx = db.scalar(select(func.max(Transaction.created_at)).where(Transaction.account_id.in_(my_accounts)))
    last_transfer = db.scalar(select(func.max(Transfer.created_at)).where(Transfer.from_account_id.in_(my_accounts)))
    candidates = [d for d in (last_tx, last_transfer) if d is not None]
    return max(candidates) if candidates else None


def compute_notifications(db: Session, user: User, today: date | None = None) -> list[Notification]:
    today = today or _today()
    month = f"{today.year:04d}-{today.month:02d}"
    has_accounts = db.scalar(select(func.count()).select_from(Account).where(Account.owner_id == user.id)) > 0
    items: list[Notification] = []

    items += _budget_notifications(db, user, month)

    income, expense = _month_totals(db, user, month)
    if income > 0 and expense > income:
        items.append(Notification(
            key=f"overspending:{month}",
            kind="overspending",
            severity="critical",
            title="Este mes gastas más de lo que ganas",
            message=f"Llevas {_clp(expense)} en gastos y {_clp(income)} en ingresos. Revisa en qué categorías puedes recortar.",
            link="/estadisticas",
        ))

    items += _card_notifications(db, user, month)
    items += _goal_notifications(db, user, today, month)

    if user.payday:
        payday = _next_payday(user.payday, today)
        days = (payday - today).days
        if days <= PAYDAY_NOTICE_DAYS:
            when = "mañana" if days == 1 else f"en {days} días"
            items.append(Notification(
                key=f"payday:{payday.isoformat()}",
                kind="payday",
                severity="info",
                title=f"Tu sueldo llega {when}",
                message=f"Págate primero: apenas llegue, aparta el {user.savings_target_pct}% para tus ahorros antes de gastar.",
                link="/ahorros",
            ))

    if has_accounts:
        last = _last_activity(db, user)
        if last is None:
            items.append(Notification(
                key="inactive:never",
                kind="inactive",
                severity="info",
                title="Registra tu primer movimiento",
                message="Anota tus gastos e ingresos para empezar a ver a dónde se va tu plata.",
                link="/movimientos",
            ))
        elif (today - last.date()).days >= INACTIVITY_DAYS:
            items.append(Notification(
                key=f"inactive:{last.date().isoformat()}",
                kind="inactive",
                severity="info",
                title=f"Llevas {(today - last.date()).days} días sin registrar movimientos",
                message="Anotar cada gasto, aunque sea pequeño, es lo que hace que tus números sean reales.",
                link="/movimientos",
            ))

    return sorted(items, key=lambda n: SEVERITY_ORDER[n.severity])
