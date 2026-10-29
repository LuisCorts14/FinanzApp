import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";
import AuthLayout from "../components/AuthLayout";
import { tooManyAttemptsMessage } from "../utils/apiError";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      const blocked = tooManyAttemptsMessage(err);
      if (blocked) setError(blocked);
      else setSent(true); // la respuesta no revela si el email existe
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={sent ? "Revisa tu correo" : "Recupera tu contraseña"}
      subtitle={sent ? undefined : "Te enviaremos un link para crear una nueva."}
      footer={<Link to="/login">← Volver a iniciar sesión</Link>}
    >
      {sent ? (
        <>
          <div className="auth-notice">
            Si hay una cuenta con <strong>{email}</strong>, te llegará en unos minutos un correo con un link para
            crear una nueva contraseña. El link dura 30 minutos.
          </div>
          {/* Ayuda para quien no recibe el correo, sin revelar si el email está registrado. */}
          <div className="auth-help">
            <p className="auth-help-title">¿No te llega?</p>
            <ul>
              <li>Revisa la carpeta de spam o promociones.</li>
              <li>
                Confirma que sea el correo con el que te registraste.{" "}
                <button type="button" className="auth-help-link" onClick={() => setSent(false)}>
                  Probar con otro correo
                </button>
              </li>
              <li>
                ¿Aún no tienes cuenta? <Link to="/register">Crea una gratis</Link>
              </li>
            </ul>
          </div>
        </>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="button-block" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar link de recuperación"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
