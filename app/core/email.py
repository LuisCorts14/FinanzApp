"""Envío de correos (por ahora, solo el de recuperar contraseña).

Usa el primer método configurado:
1. SMTP (p. ej. un Gmail dedicado con contraseña de aplicación): gratis y llega a cualquier correo.
2. Resend: necesita un dominio verificado para enviar a cualquier correo.
3. Ninguno: el link se imprime en la consola (desarrollo).
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SUBJECT = "Recupera tu contraseña - FinanzApp"


def _text_body(reset_link: str) -> str:
    return (
        "Solicitaste recuperar tu contraseña en FinanzApp.\n\n"
        f"Crea una nueva aquí: {reset_link}\n\n"
        "El link expira en 30 minutos. Si no fuiste tú, ignora este correo: tu contraseña no cambia."
    )


def _html_body(reset_link: str) -> str:
    return (
        '<div style="font-family:Arial,sans-serif;max-width:480px;color:#1f2a24">'
        '<h2 style="color:#0f7d5c">FinanzApp</h2>'
        "<p>Solicitaste recuperar tu contraseña.</p>"
        f'<p><a href="{reset_link}" style="display:inline-block;background:#0f7d5c;color:#fff;'
        'padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Crear una nueva contraseña</a></p>'
        '<p style="color:#5b6b63;font-size:14px">El link expira en 30 minutos. Si no fuiste tú, ignora este correo: '
        "tu contraseña no cambia.</p>"
        "</div>"
    )


def _send_smtp(to_email: str, reset_link: str) -> None:
    message = EmailMessage()
    message["Subject"] = SUBJECT
    # Gmail solo permite enviar como la cuenta autenticada, así que el remitente es SMTP_USER.
    message["From"] = formataddr(("FinanzApp", settings.SMTP_USER))
    message["To"] = to_email
    message.set_content(_text_body(reset_link))
    message.add_alternative(_html_body(reset_link), subtype="html")

    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=ssl.create_default_context(), timeout=10) as smtp:
        smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(message)


def _send_resend(to_email: str, reset_link: str) -> None:
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": SUBJECT,
            "html": _html_body(reset_link),
            "text": _text_body(reset_link),
        },
        timeout=10,
    )
    response.raise_for_status()


def email_provider() -> str:
    """Método de envío configurado: "smtp", "resend" o "ninguno". Lo muestra /health-check (sin credenciales)."""
    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        return "smtp"
    if settings.RESEND_API_KEY:
        return "resend"
    return "ninguno"


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Si el envío falla, se registra en el log y no se lanza el error.

    La respuesta de "recuperar contraseña" es siempre la misma (no revela si el email existe),
    así que un error 500 solo filtraría información sin ayudar a la persona.
    """
    provider = email_provider()
    if provider == "ninguno":
        print(f"[DEV] Correo no configurado. Link de recuperación para {to_email}: {reset_link}")
        return
    send = _send_smtp if provider == "smtp" else _send_resend

    try:
        send(to_email, reset_link)
    except Exception:
        logger.exception("No se pudo enviar el correo de recuperación")
