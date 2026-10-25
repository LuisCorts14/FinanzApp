from pydantic import BaseModel


class CategoryTotal(BaseModel):
    category_id: int
    category_name: str
    total: float


class MonthlySummary(BaseModel):
    month: str
    income: float
    expense: float


class BudgetStatus(BaseModel):
    category_id: int
    category_name: str
    monthly_budget: float
    spent: float


class WeeklySummary(BaseModel):
    week: int
    start_day: int
    end_day: int
    income: float
    expense: float
