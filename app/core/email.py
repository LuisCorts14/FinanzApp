import httpx

from app.core.config import settings


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    if not settings.RESEND_API_KEY:
        print(f"[DEV] RESEND_API_KEY no configurada. Link de recuperación para {to_email}: {reset_link}")
        return

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": "Recupera tu contraseña - FinanzApp",
            "html": (
                "<p>Solicitaste recuperar tu contraseña en FinanzApp.</p>"
                f'<p><a href="{reset_link}">Haz clic aquí para crear una nueva contraseña</a></p>'
                "<p>Este link expira en 30 minutos. Si no fuiste tú, ignora este correo.</p>"
            ),
        },
        timeout=10,
    )
    response.raise_for_status()
