import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "FinanzApp"
    API_V1_PREFIX: str = "/api/v1"
    DATABASE_URL: str
    # Orígenes permitidos por CORS, separados por coma (en producción: la URL del frontend en Vercel).
    CORS_ORIGINS: str = "http://localhost:5173"
    # Email de la cuenta demo pública ("Probar la demo"); vacío = sin demo.
    DEMO_EMAIL: str = ""
    # Límite de intentos en login, registro, recuperación de contraseña, etc. (los tests lo desactivan).
    RATE_LIMIT_ENABLED: bool = True

    SECRET_KEY: str = "dev-only-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    FRONTEND_URL: str = "http://localhost:5173"
    # Correos: SMTP (p. ej. un Gmail dedicado con contraseña de aplicación) o Resend. Sin ninguno, el link
    # de recuperación se imprime en la consola.
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "FinanzApp <onboarding@resend.dev>"
    # "Recuperar contraseña" tarda al menos esto exista o no el email, para que el tiempo del envío
    # (1-2 s por SMTP) no delate qué cuentas existen. Debe superar lo que suele tardar un envío.
    FORGOT_PASSWORD_MIN_SECONDS: float = 3.0

    # Escaneo de boletas con Claude: sin API key, la función queda desactivada.
    ANTHROPIC_API_KEY: str = ""
    # Haiku: lee boletas bien y es el más barato (~1-2 CLP por boleta). Para más precisión: "claude-opus-5-5".
    RECEIPT_MODEL: str = "claude-haiku-5-5"
    RECEIPT_SCANS_PER_DAY: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("DATABASE_URL")
    @classmethod
    def _sqlalchemy_scheme(cls, value: str) -> str:
        # Algunos proveedores (Neon/Vercel/Heroku) entregan "postgres://", que SQLAlchemy no acepta.
        return "postgresql://" + value.removeprefix("postgres://") if value.startswith("postgres://") else value

    @field_validator("SMTP_PASSWORD")
    @classmethod
    def _without_spaces(cls, value: str) -> str:
        # Google muestra la contraseña de aplicación en grupos ("abcd efgh ijkl mnop"); se acepta copiada así.
        return value.replace(" ", "")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_serverless(self) -> bool:
        # Vercel define VERCEL=1 en sus funciones.
        return os.environ.get("VERCEL") == "1"


settings = Settings()
