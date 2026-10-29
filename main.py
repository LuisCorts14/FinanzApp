from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.email import email_provider

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Para que el frontend pueda leer el nombre del archivo al exportar el CSV.
    expose_headers=["Content-Disposition"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {"name": settings.PROJECT_NAME, "docs": "/docs", "health": "/health-check"}


@app.get("/health-check")
def health_check():
    # "email" dice solo qué método de envío hay configurado, para detectar un deploy sin credenciales.
    return {"status": "ok", "email": email_provider()}
