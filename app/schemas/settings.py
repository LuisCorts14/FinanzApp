from pydantic import BaseModel, Field


class UserSettings(BaseModel):
    payday: int | None
    savings_target_pct: int
    budget_alert_pct: int
    default_account_id: int | None


class UserSettingsUpdate(BaseModel):
    payday: int | None = Field(default=None, ge=1, le=31)
    savings_target_pct: int | None = Field(default=None, ge=0, le=90)
    budget_alert_pct: int | None = Field(default=None, ge=50, le=100)
    default_account_id: int | None = None
