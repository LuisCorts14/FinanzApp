from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

PASSWORD_MIN_LENGTH = 6


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)
    full_name: str | None = Field(default=None, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    is_demo: bool = False
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    # Obligatoria solo para cambiar el email.
    current_password: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH)


class DeleteAccountRequest(BaseModel):
    password: str


class UserSummary(BaseModel):
    accounts: int
    transactions: int
    transfers: int
    categories: int
    savings_goals: int
