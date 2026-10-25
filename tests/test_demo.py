import sys

import pytest
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine

DEMO = "demo@example.com"


def make_demo(make_user):
    headers = make_user(DEMO, password="demo12345")
    with engine.begin() as conn:
        conn.execute(text("UPDATE users SET is_demo = true WHERE email = :e"), {"e": DEMO})
    return headers


def test_demo_login(client, make_user, monkeypatch):
    assert client.post("/api/v1/auth/demo").status_code == 404  # sin DEMO_EMAIL configurado
    monkeypatch.setattr(settings, "DEMO_EMAIL", DEMO)
    assert client.post("/api/v1/auth/demo").status_code == 404  # configurado pero sin usuario

    make_demo(make_user)
    resp = client.post("/api/v1/auth/demo")
    assert resp.status_code == 200
    assert resp.json()["user"]["is_demo"] is True
    token = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    assert client.get("/api/v1/accounts", headers=token).status_code == 200


def test_demo_email_pointing_to_a_real_account_does_not_log_in(client, make_user, monkeypatch):
    make_user(DEMO)  # usuario normal, no demo
    monkeypatch.setattr(settings, "DEMO_EMAIL", DEMO)
    assert client.post("/api/v1/auth/demo").status_code == 404


def test_demo_account_access_cannot_be_changed(client, make_user, sent_emails):
    headers = make_demo(make_user)
    assert client.patch("/api/v1/auth/me", headers=headers, json={"full_name": "Hack"}).status_code == 403
    resp = client.post(
        "/api/v1/auth/change-password", headers=headers, json={"current_password": "demo12345", "new_password": "otra1234"}
    )
    assert resp.status_code == 403
    assert client.post("/api/v1/auth/delete-account", headers=headers, json={"password": "demo12345"}).status_code == 403
    client.post("/api/v1/auth/forgot-password", json={"email": DEMO})
    assert sent_emails == []
    # Usar la app sí está permitido.
    assert client.post("/api/v1/accounts", headers=headers, json={"name": "X", "type": "bank", "balance": 0}).status_code == 201


def run_demo_script(monkeypatch, email):
    import scripts.demo_account as demo_account

    monkeypatch.setattr(sys, "argv", ["demo_account.py", email])
    demo_account.main()


def test_demo_script_balances_match_their_movements(client, monkeypatch):
    run_demo_script(monkeypatch, DEMO)
    run_demo_script(monkeypatch, DEMO)  # reiniciar no duplica nada

    with engine.connect() as conn:
        assert conn.scalar(text("SELECT count(*) FROM users WHERE email = :e AND is_demo"), {"e": DEMO}) == 1
        rows = conn.execute(text("SELECT id, name, balance FROM accounts")).all()
        for account_id, name, balance in rows:
            moved = conn.scalar(
                text(
                    """
                    SELECT COALESCE(SUM(CASE WHEN c.type = 'INCOME' THEN t.amount ELSE -t.amount END), 0)
                    FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.account_id = :a
                    """
                ),
                {"a": account_id},
            )
            moved += conn.scalar(text("SELECT COALESCE(SUM(to_amount), 0) FROM transfers WHERE to_account_id = :a"), {"a": account_id})
            moved -= conn.scalar(text("SELECT COALESCE(SUM(amount), 0) FROM transfers WHERE from_account_id = :a"), {"a": account_id})
            initial = {"CuentaRUT": 180000, "Tarjeta CMR": -95000, "Efectivo": 20000, "Ahorro viaje": 150000}[name]
            assert balance == initial + moved, name
        future = conn.scalar(text("SELECT count(*) FROM transactions WHERE date > CURRENT_DATE"))
        assert future == 0


def test_demo_script_never_touches_a_real_account(client, make_user, monkeypatch):
    make_user("real@example.com")
    with pytest.raises(SystemExit):
        run_demo_script(monkeypatch, "real@example.com")
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT is_demo FROM users WHERE email = 'real@example.com'")) is False
