from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

# En funciones serverless cada instancia vive poco: mejor no mantener un pool propio (Neon ya trae uno).
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    **({"poolclass": NullPool} if settings.is_serverless else {}),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
