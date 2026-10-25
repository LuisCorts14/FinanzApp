import { useEffect, useState } from "react";
import { createCategory } from "../api/categories";
import type { TransactionType } from "../api/types";
import { CloseIcon } from "./Icons";

interface CategoryFormModalProps {
  incomeLimitReached: boolean;
  maxIncome: number;
  onClose: () => void;
  onCreated: () => void;
}

export default function CategoryFormModal({
  incomeLimitReached,
  maxIncome,
  onClose,
  onCreated,
}: CategoryFormModalProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCategory({
        name: name.trim(),
        type,
        monthly_budget: type === "expense" && budget ? Number(budget) : null,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { detail?: string } } })?.response;
      if (response?.status === 409) setError("Ya tienes una categoría con ese nombre.");
      else setError(response?.data?.detail || "No se pudo crear la categoría.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-category-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="new-category-title">Nueva categoría</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="segmented" role="tablist" aria-label="Tipo de categoría">
            <button
              type="button"
              role="tab"
              aria-selected={type === "expense"}
              className={type === "expense" ? "active" : ""}
              onClick={() => setType("expense")}
            >
              Gasto
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={type === "income"}
              className={type === "income" ? "active" : ""}
              onClick={() => setType("income")}
              disabled={incomeLimitReached}
              title={incomeLimitReached ? `Ya tienes ${maxIncome} categorías de ingreso` : undefined}
            >
              Ingreso
            </button>
          </div>

          <label>
            Nombre
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "expense" ? "Ej. Comida, Transporte" : "Ej. Sueldo"}
              maxLength={100}
              required
              autoFocus
            />
          </label>

          {type === "expense" && (
            <label>
              Presupuesto mensual (opcional)
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Sin límite"
              />
              <span className="field-hint">
                Es el máximo que quieres gastar en esto cada mes. Te avisaremos cuando te acerques.
              </span>
            </label>
          )}

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Creando..." : "Crear categoría"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
