from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# En Vercel una instancia atiende muchos requests seguidos (y en paralelo): reusar conexiones evita repetir
# el handshake TLS + autenticación con Neon en cada uno. Pool chico porque el pooler de Neon ya multiplexa;
# pool_recycle bajo porque Neon cierra las conexiones inactivas, y pool_pre_ping descarta las que murieron.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    **({"pool_size": 3, "max_overflow": 7, "pool_recycle": 240} if settings.is_serverless else {}),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
