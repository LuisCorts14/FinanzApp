import { useEffect, useState } from "react";
import { createContribution } from "../api/savingsGoals";
import type { SavingsGoal } from "../api/types";
import { formatCLP } from "../utils/format";
import { toISODate, todayLocal } from "../utils/savings";
import { CloseIcon } from "./Icons";

interface ContributionModalProps {
  goal: SavingsGoal;
  onClose: () => void;
  onCreated: () => void;
}

type Kind = "deposit" | "withdrawal";

export default function ContributionModal({ goal, onClose, onCreated }: ContributionModalProps) {
  const [kind, setKind] = useState<Kind>("deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => toISODate(todayLocal()));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const value = Number(amount) || 0;
  const tooMuch = kind === "withdrawal" && value > goal.current_amount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value <= 0 || tooMuch) return;
    setSubmitting(true);
    setError(null);
    try {
      await createContribution(goal.id, {
        amount: kind === "deposit" ? value : -value,
        date,
        note: note.trim() || null,
      });
      onCreated();
      onClose();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
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
        aria-labelledby="contribution-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="contribution-title">{kind === "deposit" ? "Ingresar abono" : "Registrar retiro"}</h2>
            <p className="modal-subtitle">
              {goal.name} · llevas {formatCLP(goal.current_amount)} de {formatCLP(goal.target_amount)}
            </p>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="segmented" role="tablist" aria-label="Tipo de movimiento">
            <button
              type="button"
              role="tab"
              aria-selected={kind === "deposit"}
              className={kind === "deposit" ? "active" : ""}
              onClick={() => setKind("deposit")}
            >
              Abono
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === "withdrawal"}
              className={kind === "withdrawal" ? "active" : ""}
              onClick={() => setKind("withdrawal")}
              disabled={goal.current_amount <= 0}
            >
              Retiro
            </button>
          </div>

          <label>
            Monto
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
              autoFocus
            />
            {tooMuch && (
              <span className="field-hint field-hint-error">
                Solo puedes retirar hasta {formatCLP(goal.current_amount)}.
              </span>
            )}
            {kind === "withdrawal" && !tooMuch && (
              <span className="field-hint">Registrar los retiros te ayuda a ver tu avance real.</span>
            )}
          </label>

          <div className="modal-grid">
            <label>
              Fecha
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              Nota
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={kind === "deposit" ? "Ej. Sueldo de octubre" : "Ej. Imprevisto"}
                maxLength={200}
              />
            </label>
          </div>

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting || value <= 0 || tooMuch}>
              {submitting ? "Guardando..." : kind === "deposit" ? "Abonar" : "Retirar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
