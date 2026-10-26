from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DebtKind

# Tasa de interés mensual en %. 20% mensual ya es absurdo: el tope evita errores de tipeo (p. ej. poner la anual).
MonthlyRate = Field(ge=0, le=20)


class DebtCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    kind: DebtKind
    balance: float = Field(gt=0)
    interest_rate: float = MonthlyRate
    minimum_payment: float = Field(gt=0)


class DebtUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    kind: DebtKind | None = None
    balance: float | None = Field(default=None, ge=0)
    interest_rate: float | None = Field(default=None, ge=0, le=20)
    minimum_payment: float | None = Field(default=None, gt=0)


class DebtRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    kind: DebtKind
    balance: float
    interest_rate: float
    minimum_payment: float
    created_at: datetime


class DebtPaymentCreate(BaseModel):
    amount: float = Field(gt=0)


class DebtPlanSettings(BaseModel):
    monthly_budget: float | None = Field(default=None, gt=0)
    strategy: Literal["avalanche", "snowball"] = "avalanche"


class PlanDebt(BaseModel):
    """Una deuda dentro del plan: una tarjeta de crédito (source="card") o una deuda registrada ("debt")."""

    key: str
    source: Literal["card", "debt"]
    id: int
    name: str
    kind: str
    balance: float  # en CLP
    interest_rate: float | None
    minimum_payment: float | None  # en CLP
    monthly_interest: float
    # Las tarjetas sin tasa o sin pago mínimo no se pueden simular: se muestran pidiendo esos datos.
    included: bool


class PlanPayoff(BaseModel):
    key: str
    name: str
    month: int


class PlanScenario(BaseModel):
    status: Literal["ok", "insufficient_budget", "never"]
    months: int | None
    total_interest: float
    total_paid: float
    payoffs: list[PlanPayoff]
    timeline: list[float]


class DebtPlan(BaseModel):
    monthly_budget: float
    budget_is_saved: bool
    strategy: Literal["avalanche", "snowball"]
    total_balance: float
    total_minimum: float
    monthly_interest: float
    debts: list[PlanDebt]
    avalanche: PlanScenario
    snowball: PlanScenario
    minimum_only: PlanScenario
