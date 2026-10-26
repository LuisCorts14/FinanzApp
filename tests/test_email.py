from app.core import email
from app.core.config import settings


class FakeSMTP:
    sent = []

    def __init__(self, host, port, context=None, timeout=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def login(self, user, password):
        self.user = user

    def send_message(self, message):
        FakeSMTP.sent.append(message)


def test_smtp_is_used_when_configured(monkeypatch):
    FakeSMTP.sent = []
    monkeypatch.setattr(settings, "SMTP_USER", "finanzapp@gmail.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "app-password")
    monkeypatch.setattr(email.smtplib, "SMTP_SSL", FakeSMTP)

    email.send_password_reset_email("ana@example.com", "https://app/reset-password?token=abc")

    [message] = FakeSMTP.sent
    assert message["To"] == "ana@example.com"
    assert "finanzapp@gmail.com" in message["From"]
    assert "https://app/reset-password?token=abc" in message.get_body(("plain",)).get_content()
    assert "token=abc" in message.get_body(("html",)).get_content()


def test_send_failure_is_logged_not_raised(monkeypatch, caplog):
    def broken(*args, **kwargs):
        raise OSError("sin conexión")

    monkeypatch.setattr(settings, "SMTP_USER", "finanzapp@gmail.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "app-password")
    monkeypatch.setattr(email.smtplib, "SMTP_SSL", broken)

    email.send_password_reset_email("ana@example.com", "https://app/x")
    assert "No se pudo enviar" in caplog.text


def test_without_config_the_link_is_printed(monkeypatch, capsys):
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    email.send_password_reset_email("ana@example.com", "https://app/x")
    assert "https://app/x" in capsys.readouterr().out
