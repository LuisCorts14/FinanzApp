import { useEffect, useState } from "react";
import { createSavingsGoal } from "../api/savingsGoals";
import type { Account } from "../api/types";
import { formatMoney } from "../utils/format";
import { CloseIcon } from "./Icons";

interface GoalFormModalProps {
  accounts: Account[];
  onClose: () => void;
  onCreated: () => void;
}

export default function GoalFormModal({ accounts, onClose, onCreated }: GoalFormModalProps) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [accountId, setAccountId] = useState("");
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
    if (!name.trim() || !targetAmount || !targetDate) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSavingsGoal({
        account_id: accountId ? Number(accountId) : null,
        name: name.trim(),
        target_amount: Number(targetAmount),
        target_date: targetDate,
      });
      onCreated();
      onClose();
    } catch {
      setError("No se pudo crear la meta. Intenta de nuevo.");
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
        aria-labelledby="new-goal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="new-goal-title">Nueva meta de ahorro</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            ¿Para qué quieres ahorrar?
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Viaje, fondo de emergencia"
              maxLength={100}
              required
              autoFocus
            />
          </label>

          <div className="modal-grid">
            <label>
              Monto objetivo
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0"
                required
              />
            </label>
            <label>
              ¿Para cuándo?
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
            </label>
          </div>

          <label>
            ¿Dónde guardarás este ahorro?
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Lo iré registrando con abonos</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  En mi cuenta {a.name} ({formatMoney(a.balance, a.currency)})
                </option>
              ))}
            </select>
            <span className="field-hint">
              {accountId
                ? "El avance será el saldo de esa cuenta: conviene usar una cuenta solo para este ahorro."
                : "Cada vez que guardes plata para esta meta, ingresa un abono y verás tu historial."}
            </span>
          </label>

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Creando..." : "Crear meta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
