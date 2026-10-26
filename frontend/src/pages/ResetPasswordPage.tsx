import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth";
import AuthLayout from "../components/AuthLayout";
import PasswordInput from "../components/PasswordInput";
import { tooManyAttemptsMessage } from "../utils/apiError";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(tooManyAttemptsMessage(err) ?? "El link es inválido o ya expiró. Solicita uno nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout
        title="Link inválido"
        subtitle="Este link no tiene un token válido o está incompleto."
        footer={<Link to="/forgot-password">Solicitar un link nuevo</Link>}
      >
        <div className="auth-notice auth-notice-warning">Copia el link completo desde el correo, o pide uno nuevo.</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Crea una nueva contraseña"
      subtitle={success ? undefined : "Elige una que no uses en otros sitios."}
      footer={<Link to="/login">← Volver a iniciar sesión</Link>}
    >
      {success ? (
        <div className="auth-notice">Contraseña actualizada. Te llevamos a iniciar sesión...</div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Nueva contraseña
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
              autoFocus
            />
          </label>
          <label>
            Repite la contraseña
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="button-block" disabled={submitting}>
            {submitting ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
