import time
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.email import send_password_reset_email
from app.core.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)
from app.db.session import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.password_reset_token import PasswordResetToken
from app.models.savings_goal import SavingsGoal
from app.models.transaction import Transaction
from app.models.transfer import Transfer
from app.models.user import User
from app.services import rate_limit as rl
from app.schemas.user import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRead,
    UserSummary,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])

RESET_TOKEN_EXPIRE_MINUTES = 30


def _session(user: User) -> TokenResponse:
    token = create_access_token(subject=str(user.id), version=user.token_version)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


def _wrong_password() -> HTTPException:
    # 400 y no 401: un 401 hace que el frontend cierre la sesión, y aquí solo se escribió mal la contraseña.
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual no es correcta")


def _forbid_demo(user: User) -> None:
    if user.is_demo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta es la cuenta demo: no se puede cambiar su acceso ni eliminarla. Crea tu propia cuenta gratis.",
        )


def _utcnow() -> datetime:
    # La columna guarda fechas UTC sin zona horaria.
    return datetime.now(UTC).replace(tzinfo=None)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    rl.enforce(db, "register", [(f"ip:{rl.client_ip(request)}", rl.REGISTER_PER_IP)])
    existing = db.scalar(select(User).where(User.email == user_in.email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _session(user)


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    rl.enforce(
        db,
        "login",
        [
            (f"email:{credentials.email.lower()}", rl.LOGIN_PER_EMAIL),
            (f"ip:{rl.client_ip(request)}", rl.LOGIN_PER_IP),
        ],
    )
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
    )
    user = db.scalar(select(User).where(User.email == credentials.email))
    if user is None or not verify_password(credentials.password, user.hashed_password):
        raise invalid_credentials

    return _session(user)


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    started = time.monotonic()
    rl.enforce(
        db,
        "forgot",
        [
            (f"email:{payload.email.lower()}", rl.FORGOT_PER_EMAIL),
            (f"ip:{rl.client_ip(request)}", rl.FORGOT_PER_IP),
        ],
    )
    user = db.scalar(select(User).where(User.email == payload.email))

    if user is not None and not user.is_demo:
        raw_token = generate_reset_token()
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=_utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
        )
        db.add(reset_token)
        db.commit()

        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
        # Se envía antes de responder: en Vercel la función se congela al entregar la respuesta, así que
        # una tarea en segundo plano no alcanza a mandar el correo.
        send_password_reset_email(user.email, reset_link)

    # Ambos caminos tardan lo mismo, para que el tiempo de respuesta no delate si el email está registrado.
    remaining = settings.FORGOT_PASSWORD_MIN_SECONDS - (time.monotonic() - started)
    if remaining > 0:
        time.sleep(remaining)

    return {"detail": "Si el email existe, se envió un link de recuperación."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    rl.enforce(db, "reset", [(f"ip:{rl.client_ip(request)}", rl.RESET_PER_IP)])
    invalid_token = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido o expirado"
    )

    token_hash = hash_reset_token(payload.token)
    reset_token = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )

    now = _utcnow()
    if reset_token is None or reset_token.used_at is not None or reset_token.expires_at < now:
        raise invalid_token

    user = db.get(User, reset_token.user_id)
    user.hashed_password = hash_password(payload.new_password)
    user.token_version += 1  # cierra las sesiones abiertas con la contraseña anterior
    reset_token.used_at = now
    db.commit()

    return {"detail": "Contraseña actualizada correctamente."}


@router.patch("/me", response_model=UserRead)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _forbid_demo(current_user)
    data = payload.model_dump(exclude_unset=True)

    if "full_name" in data:
        current_user.full_name = (data["full_name"] or "").strip() or None

    new_email = data.get("email")
    if new_email and new_email.lower() != current_user.email.lower():
        if not payload.current_password or not verify_password(payload.current_password, current_user.hashed_password):
            raise _wrong_password()
        taken = db.scalar(select(User).where(func.lower(User.email) == new_email.lower(), User.id != current_user.id))
        if taken is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese email ya está registrado")
        current_user.email = new_email

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=TokenResponse)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _forbid_demo(current_user)
    rl.enforce(db, "sensitive", [(f"user:{current_user.id}", rl.SENSITIVE_PER_USER)])
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise _wrong_password()
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.token_version += 1  # cierra las demás sesiones
    db.commit()
    db.refresh(current_user)
    # Se devuelve un token nuevo para que esta sesión siga abierta.
    return _session(current_user)


@router.get("/me/summary", response_model=UserSummary)
def my_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    def count(stmt) -> int:
        return db.scalar(select(func.count()).select_from(stmt.subquery()))

    my_accounts = select(Account.id).where(Account.owner_id == current_user.id)
    return UserSummary(
        accounts=count(my_accounts),
        transactions=count(select(Transaction.id).where(Transaction.account_id.in_(my_accounts))),
        transfers=count(
            select(Transfer.id).where(
                or_(Transfer.from_account_id.in_(my_accounts), Transfer.to_account_id.in_(my_accounts))
            )
        ),
        categories=count(select(Category.id).where(Category.owner_id == current_user.id)),
        savings_goals=count(select(SavingsGoal.id).where(SavingsGoal.owner_id == current_user.id)),
    )


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _forbid_demo(current_user)
    rl.enforce(db, "sensitive", [(f"user:{current_user.id}", rl.SENSITIVE_PER_USER)])
    if not verify_password(payload.password, current_user.hashed_password):
        raise _wrong_password()
    # Las llaves foráneas tienen ON DELETE CASCADE: se borran cuentas, movimientos, categorías y metas.
    db.delete(current_user)
    db.commit()


@router.post("/demo", response_model=TokenResponse)
def demo_login(request: Request, db: Session = Depends(get_db)):
    """Entra a la cuenta demo sin contraseña ("Probar la demo"). Solo si está configurada y marcada como demo."""
    rl.enforce(db, "demo", [(f"ip:{rl.client_ip(request)}", rl.DEMO_PER_IP)])
    user = db.scalar(select(User).where(User.email == settings.DEMO_EMAIL)) if settings.DEMO_EMAIL else None
    if user is None or not user.is_demo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La demo no está disponible")
    return _session(user)
