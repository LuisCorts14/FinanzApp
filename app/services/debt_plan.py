"""Simulación mes a mes de un plan para pagar deudas.

Cada mes, a cada deuda se le suman los intereses del mes y luego se paga: primero el mínimo de
todas y lo que sobra del presupuesto va completo a la deuda prioritaria. Cuando una deuda se
termina, su mínimo queda libre y se suma al pago de la siguiente (el "efecto bola de nieve").

- Avalancha: prioriza la tasa más alta. Es la que paga menos intereses.
- Bola de nieve: prioriza el saldo más chico. Se terminan deudas antes, lo que motiva a seguir.
- Solo mínimos: lo que pasa si se paga solo el mínimo de cada deuda, sin pagos extra.
"""

from dataclasses import dataclass, field
from typing import Literal

Strategy = Literal["avalanche", "snowball"]

MAX_MONTHS = 600  # 50 años: si no termina antes, se considera que la deuda no se termina de pagar.
_PAID = 0.5  # bajo medio peso, la deuda se da por pagada (evita arrastrar centavos por redondeo)


@dataclass(frozen=True)
class DebtInput:
    key: str
    name: str
    balance: float
    monthly_rate_pct: float
    minimum_payment: float


@dataclass
class Payoff:
    key: str
    name: str
    month: int  # mes (desde 1) en que queda pagada


@dataclass
class Scenario:
    status: Literal["ok", "insufficient_budget", "never"]
    months: int | None = None
    total_interest: float = 0
    total_paid: float = 0
    payoffs: list[Payoff] = field(default_factory=list)
    # Deuda total al terminar cada mes; el primer valor es la deuda actual.
    timeline: list[float] = field(default_factory=list)


def _priority(strategy: Strategy, debt: DebtInput, balance: float) -> tuple:
    if strategy == "avalanche":
        return (-debt.monthly_rate_pct, balance, debt.key)
    return (balance, -debt.monthly_rate_pct, debt.key)


def simulate(debts: list[DebtInput], budget: float, strategy: Strategy | None) -> Scenario:
    """`strategy=None` simula pagar solo los mínimos (el presupuesto se ignora)."""
    debts = [d for d in debts if d.balance > _PAID]
    balances = {d.key: d.balance for d in debts}
    if not debts:
        return Scenario(status="ok", months=0, timeline=[0])
    if strategy is not None and budget + _PAID < sum(d.minimum_payment for d in debts):
        return Scenario(status="insufficient_budget", timeline=[round(sum(balances.values()))])

    scenario = Scenario(status="ok", timeline=[round(sum(balances.values()))])
    for month in range(1, MAX_MONTHS + 1):
        active = [d for d in debts if balances[d.key] > _PAID]
        for d in active:
            interest = balances[d.key] * d.monthly_rate_pct / 100
            balances[d.key] += interest
            scenario.total_interest += interest

        available = budget if strategy is not None else float("inf")
        for d in active:
            pay = min(d.minimum_payment, balances[d.key], available)
            balances[d.key] -= pay
            available -= pay
            scenario.total_paid += pay

        if strategy is not None:
            for d in sorted(active, key=lambda d: _priority(strategy, d, balances[d.key])):
                if available <= 0:
                    break
                pay = min(balances[d.key], available)
                balances[d.key] -= pay
                available -= pay
                scenario.total_paid += pay

        for d in active:
            if balances[d.key] <= _PAID:
                balances[d.key] = 0
                scenario.payoffs.append(Payoff(d.key, d.name, month))
        scenario.timeline.append(round(sum(balances.values())))

        if all(b <= _PAID for b in balances.values()):
            scenario.months = month
            break
    else:
        scenario.status = "never"

    scenario.total_interest = round(scenario.total_interest)
    scenario.total_paid = round(scenario.total_paid)
    return scenario
