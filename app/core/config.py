from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "FinanzApp"
    API_V1_PREFIX: str = "/api/v1"
    DATABASE_URL: str

    SECRET_KEY: str = "dev-only-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    FRONTEND_URL: str = "http://localhost:5173"
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "FinanzApp <onboarding@resend.dev>"

    # Escaneo de boletas con Claude: sin API key, la función queda desactivada.
    ANTHROPIC_API_KEY: str = ""
    # Haiku: lee boletas bien y es el más barato (~1-2 CLP por boleta). Para más precisión: "claude-opus-5-5".
    RECEIPT_MODEL: str = "claude-haiku-5-5"
    RECEIPT_SCANS_PER_DAY: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
