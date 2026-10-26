import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import DemoButton from "../components/DemoButton";
import { DEMO_ENABLED } from "../utils/demo";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { tooManyAttemptsMessage } from "../utils/apiError";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(tooManyAttemptsMessage(err) ?? "Email o contraseña incorrectos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Hola de nuevo"
      subtitle="Ingresa para ver cómo van tus finanzas."
      footer={
        <>
          ¿No tienes cuenta? <Link to="/register">Créala gratis</Link>
          {DEMO_ENABLED && (
            <span className="auth-demo">
              ¿Solo quieres mirar? <DemoButton className="link-button-muted" label="Entra a la demo" />
            </span>
          )}
        </>
      }
    >
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
        <label>
          <span className="label-row">
            Contraseña
            <Link to="/forgot-password" className="label-link">
              ¿La olvidaste?
            </Link>
          </span>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="button-block" disabled={submitting}>
          {submitting ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </AuthLayout>
  );
}
