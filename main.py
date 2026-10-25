from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Para que el frontend pueda leer el nombre del archivo al exportar el CSV.
    expose_headers=["Content-Disposition"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health-check")
def health_check():
    return {"status": "ok"}
