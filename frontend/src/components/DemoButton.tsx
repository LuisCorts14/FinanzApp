import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { demoLogin } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { DEMO_ENABLED } from "../utils/demo";

export default function DemoButton({
  className = "",
  label = "Probar la demo",
}: {
  className?: string;
  label?: string;
}) {
  const { applySession } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  if (!DEMO_ENABLED) return null;

  async function handleClick() {
    setLoading(true);
    setError(false);
    try {
      applySession(await demoLogin());
      navigate("/");
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={handleClick} disabled={loading}>
        {loading ? "Entrando..." : label}
      </button>
      {error && <span className="demo-error">La demo no está disponible en este momento.</span>}
    </>
  );
}
