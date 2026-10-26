"""Configuración compartida de los tests.

Los tests corren contra una base de datos PostgreSQL aparte (por defecto `finanzapp_test`, en el
mismo servidor que la de desarrollo). Nunca tocan la base real: si la URL no apunta a una base cuyo
nombre termina en `_test`, se detienen antes de conectarse.
"""

import os

from sqlalchemy.engine import make_url

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://finanzapp:finanzapp@localhost:15432/finanzapp_test"
)
if not (make_url(TEST_DATABASE_URL).database or "").endswith("_test"):
    raise RuntimeError(f"Por seguridad, los tests solo corren en una base terminada en '_test': {TEST_DATABASE_URL}")

# La configuración se lee al importar la app, así que la URL de prueba se fija antes de cualquier import.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["RESEND_API_KEY"] = ""
os.environ["SMTP_PASSWORD"] = ""  # los tests nunca envían correos reales
# Los tests registran muchos usuarios desde la misma "IP"; los límites se prueban aparte en test_rate_limit.py.
os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

import app.models  # noqa: E402,F401 - registra todos los modelos en Base.metadata
from app.core import currency  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from main import app  # noqa: E402

# Tasas fijas para que los tests no dependan de una API externa: 1 USD = 950 CLP.
FAKE_RATES = {"USD": {"CLP": 950.0, "USD": 1.0}, "CLP": {"CLP": 1.0, "USD": 1 / 950}}


def _ensure_test_database() -> None:
    url = make_url(TEST_DATABASE_URL)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": url.database})
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()


@pytest.fixture(scope="session", autouse=True)
def database():
    _ensure_test_database()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables():
    """Cada test parte con las tablas vacías (la app hace commit, así que no sirve un rollback)."""
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def fixed_exchange_rates(monkeypatch):
    currency._rate_cache.clear()
    monkeypatch.setattr(currency, "_fetch_rates", lambda base: FAKE_RATES[base])


@pytest.fixture
def sent_emails(monkeypatch):
    """Intercepta los correos de recuperación de contraseña y los deja en una lista."""
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.send_password_reset_email", lambda to, link: sent.append((to, link))
    )
    return sent


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def make_user(client):
    """Registra un usuario y devuelve los headers de autenticación."""

    def _make(email: str = "ana@example.com", password: str = "secreta123", full_name: str = "Ana") -> dict:
        resp = client.post("/api/v1/auth/register", json={"email": email, "password": password, "full_name": full_name})
        assert resp.status_code == 201, resp.text
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    return _make


@pytest.fixture
def auth(make_user):
    return make_user()


@pytest.fixture
def api(client, auth):
    """Atajos para llamar a la API como el usuario por defecto."""

    class Api:
        def get(self, path, **kw):
            return client.get(f"/api/v1{path}", headers=auth, **kw)

        def post(self, path, json=None, **kw):
            return client.post(f"/api/v1{path}", headers=auth, json=json, **kw)

        def patch(self, path, json=None, **kw):
            return client.patch(f"/api/v1{path}", headers=auth, json=json, **kw)

        def put(self, path, json=None, **kw):
            return client.put(f"/api/v1{path}", headers=auth, json=json, **kw)

        def delete(self, path, **kw):
            return client.delete(f"/api/v1{path}", headers=auth, **kw)

        def account(self, name="Cuenta", type="bank", balance=0, **extra):
            resp = self.post("/accounts", {"name": name, "type": type, "balance": balance, **extra})
            assert resp.status_code == 201, resp.text
            return resp.json()

        def category(self, name="Comida", type="expense", **extra):
            resp = self.post("/categories", {"name": name, "type": type, **extra})
            assert resp.status_code == 201, resp.text
            return resp.json()

        def transaction(self, account_id, category_id, amount, date="2026-10-15", **extra):
            resp = self.post(
                "/transactions",
                {"account_id": account_id, "category_id": category_id, "amount": amount, "date": date, **extra},
            )
            assert resp.status_code == 201, resp.text
            return resp.json()

        def balance(self, account_id):
            return self.get(f"/accounts/{account_id}").json()["balance"]

    return Api()
