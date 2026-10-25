from decimal import Decimal

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.account import Account


def adjust_balance(db: Session, account_id: int, delta: Decimal | float) -> None:
    """Suma `delta` al saldo de una cuenta en una sola sentencia SQL.

    Leer el saldo, sumarle en Python y volver a guardarlo pierde actualizaciones cuando llegan
    varias solicitudes a la vez (p. ej. al guardar los gastos de una boleta en paralelo):
    `UPDATE ... SET balance = balance + delta` deja que Postgres lo haga de forma atómica.
    """
    db.execute(
        update(Account)
        .where(Account.id == account_id)
        .values(balance=Account.balance + Decimal(str(delta)))
        .execution_options(synchronize_session=False)
    )
