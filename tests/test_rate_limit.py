import pytest

from app.core.config import settings
from app.services import rate_limit


@pytest.fixture(autouse=True)
def limits_on(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)


def login(client, email, password="incorrecta", ip=None):
    headers = {"x-real-ip": ip} if ip else {}
    return client.post("/api/v1/auth/login", json={"email": email, "password": password}, headers=headers)


def test_login_is_limited_per_email(client, make_user):
    make_user("ana@example.com", password="secreta123")
    for _ in range(5):
        assert login(client, "ana@example.com").status_code == 401

    blocked = login(client, "ana@example.com", password="secreta123")
    assert blocked.status_code == 429  # bloqueado aunque ahora la contraseña sea correcta
    assert int(blocked.headers["Retry-After"]) > 0
    assert "Demasiados intentos" in blocked.json()["detail"]
    # Otra cuenta desde la misma IP todavía puede entrar (aún no llega al límite por IP).
    assert login(client, "otra@example.com").status_code == 401


def test_login_is_limited_per_ip(client):
    for i in range(20):
        assert login(client, f"persona{i}@example.com").status_code == 401
    assert login(client, "persona-nueva@example.com").status_code == 429


def test_limit_resets_in_the_next_window(client, make_user, monkeypatch):
    make_user("ana@example.com", password="secreta123")
    now = 1_800_000_000.0
    monkeypatch.setattr(rate_limit.time, "time", lambda: now)
    for _ in range(5):
        login(client, "ana@example.com")
    assert login(client, "ana@example.com", password="secreta123").status_code == 429

    monkeypatch.setattr(rate_limit.time, "time", lambda: now + 61)
    assert login(client, "ana@example.com", password="secreta123").status_code == 200


def test_on_vercel_each_client_ip_has_its_own_counter(client, monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    for i in range(20):
        login(client, f"p{i}@example.com", ip="203.0.113.7")
    assert login(client, "x@example.com", ip="203.0.113.7").status_code == 429
    assert login(client, "x@example.com", ip="198.51.100.4").status_code == 401


def test_register_is_limited_per_ip(client):
    for i in range(5):
        resp = client.post("/api/v1/auth/register", json={"email": f"n{i}@example.com", "password": "secreta123"})
        assert resp.status_code == 201
    resp = client.post("/api/v1/auth/register", json={"email": "n6@example.com", "password": "secreta123"})
    assert resp.status_code == 429


def test_forgot_password_is_limited_per_email(client, make_user, sent_emails):
    make_user("ana@example.com")
    for _ in range(3):
        assert client.post("/api/v1/auth/forgot-password", json={"email": "ana@example.com"}).status_code == 200
    assert client.post("/api/v1/auth/forgot-password", json={"email": "ana@example.com"}).status_code == 429
    assert len(sent_emails) == 3  # no se envían más correos


def test_change_password_is_limited_per_user(client, make_user):
    headers = make_user("ana@example.com", password="secreta123")
    payload = {"current_password": "incorrecta", "new_password": "nueva12345"}
    for _ in range(5):
        assert client.post("/api/v1/auth/change-password", headers=headers, json=payload).status_code == 400
    assert client.post("/api/v1/auth/change-password", headers=headers, json=payload).status_code == 429


def test_disabled_flag_turns_limits_off(client, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    for i in range(30):
        assert login(client, "ana@example.com").status_code == 401
