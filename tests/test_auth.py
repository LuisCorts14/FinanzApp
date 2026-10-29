import time
from urllib.parse import parse_qs, urlparse

from app.core.config import settings


def test_register_returns_token_and_user(client):
    resp = client.post("/api/v1/auth/register", json={"email": "ana@example.com", "password": "secreta123"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["email"] == "ana@example.com"
    assert "password" not in body["user"] and "hashed_password" not in body["user"]


def test_register_duplicate_email_is_rejected(client, make_user):
    make_user("ana@example.com")
    resp = client.post("/api/v1/auth/register", json={"email": "ana@example.com", "password": "otra12345"})
    assert resp.status_code == 409


def test_login_with_correct_and_wrong_password(client, make_user):
    make_user("ana@example.com", password="secreta123")
    ok = client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "secreta123"})
    assert ok.status_code == 200 and ok.json()["access_token"]

    wrong = client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "incorrecta"})
    assert wrong.status_code == 401
    unknown = client.post("/api/v1/auth/login", json={"email": "nadie@example.com", "password": "secreta123"})
    assert unknown.status_code == 401


def test_protected_endpoints_require_a_valid_token(client):
    assert client.get("/api/v1/auth/me").status_code in (401, 403)
    assert client.get("/api/v1/accounts", headers={"Authorization": "Bearer no-es-un-token"}).status_code == 401


def test_me_returns_current_user(client, auth):
    resp = client.get("/api/v1/auth/me", headers=auth)
    assert resp.status_code == 200
    assert resp.json()["email"] == "ana@example.com"


def test_password_reset_flow(client, make_user, sent_emails):
    make_user("ana@example.com", password="vieja1234")

    resp = client.post("/api/v1/auth/forgot-password", json={"email": "ana@example.com"})
    assert resp.status_code == 200
    assert len(sent_emails) == 1
    to, link = sent_emails[0]
    assert to == "ana@example.com"
    token = parse_qs(urlparse(link).query)["token"][0]

    reset = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "nueva1234"})
    assert reset.status_code == 200

    assert client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "vieja1234"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "nueva1234"}).status_code == 200

    # El link es de un solo uso.
    again = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "otra12345"})
    assert again.status_code == 400


def test_forgot_password_does_not_reveal_unknown_emails(client, sent_emails):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "nadie@example.com"})
    assert resp.status_code == 200
    assert sent_emails == []


def test_forgot_password_takes_the_same_minimum_time_either_way(client, make_user, sent_emails, monkeypatch):
    monkeypatch.setattr(settings, "FORGOT_PASSWORD_MIN_SECONDS", 0.3)
    make_user("ana@example.com")

    for email in ("ana@example.com", "nadie@example.com"):
        start = time.monotonic()
        resp = client.post("/api/v1/auth/forgot-password", json={"email": email})
        assert resp.status_code == 200
        # Margen por la resolución del reloj (en Windows, ~15 ms).
        assert time.monotonic() - start >= 0.25

    # El correo se envía antes de responder (no en segundo plano).
    assert [to for to, _ in sent_emails] == ["ana@example.com"]


def test_reset_with_invalid_token_fails(client):
    resp = client.post("/api/v1/auth/reset-password", json={"token": "inventado", "new_password": "nueva1234"})
    assert resp.status_code == 400


def test_emails_are_matched_without_case(client, make_user, sent_emails):
    make_user("Ana@Example.com", password="secreta123")

    login = client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "secreta123"})
    assert login.status_code == 200

    dup = client.post("/api/v1/auth/register", json={"email": "ANA@example.com", "password": "otra12345"})
    assert dup.status_code == 409

    client.post("/api/v1/auth/forgot-password", json={"email": "ana@EXAMPLE.com"})
    # Llega al email de la cuenta (EmailStr puede normalizar el dominio a minúsculas).
    assert [to.lower() for to, _ in sent_emails] == ["ana@example.com"]


def test_health_check_reports_the_email_method_without_secrets(client, monkeypatch):
    assert client.get("/health-check").json() == {"status": "ok", "email": "ninguno"}

    monkeypatch.setattr(settings, "SMTP_USER", "finanzapp@gmail.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "secreto")
    body = client.get("/health-check").json()
    assert body["email"] == "smtp"
    assert "secreto" not in str(body) and "finanzapp@gmail.com" not in str(body)
