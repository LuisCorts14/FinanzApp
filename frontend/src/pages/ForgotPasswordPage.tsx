import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";
import AuthLayout from "../components/AuthLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await forgotPassword(email);
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  return (
    <AuthLayout
      title={sent ? "Revisa tu correo" : "Recupera tu contraseña"}
      subtitle={sent ? undefined : "Te enviaremos un link para crear una nueva."}
      footer={<Link to="/login">← Volver a iniciar sesión</Link>}
    >
      {sent ? (
        <div className="auth-notice">
          Si <strong>{email}</strong> está registrado, te llegará un correo con un link para restablecer tu contraseña.
          El link dura 30 minutos.
        </div>
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
          <button type="submit" className="button-block" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar link de recuperación"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
