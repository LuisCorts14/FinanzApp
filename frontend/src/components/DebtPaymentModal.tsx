import { useEffect, useState } from "react";
import { registerDebtPayment } from "../api/debts";
import type { PlanDebt } from "../api/types";
import { formatCLP } from "../utils/format";
import { CloseIcon } from "./Icons";

interface DebtPaymentModalProps {
  debt: PlanDebt;
  onClose: () => void;
  onSaved: () => void;
}

export default function DebtPaymentModal({ debt, onClose, onSaved }: DebtPaymentModalProps) {
  const [amount, setAmount] = useState(debt.minimum_payment ? String(debt.minimum_payment) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const remaining = Math.max(debt.balance - Number(amount || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await registerDebtPayment(debt.id, Number(amount));
      onSaved();
      onClose();
    } catch {
      setError("No se pudo registrar el pago. Intenta de nuevo.");
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
        aria-labelledby="debt-payment-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="debt-payment-title">Registrar pago · {debt.name}</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            ¿Cuánto pagaste?
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
            <span className="field-hint">
              {remaining === 0
                ? "¡Con este pago la deuda queda saldada!"
                : `Te quedarían ${formatCLP(remaining)} por pagar. Si el banco cobró intereses, ajusta el saldo con "Editar".`}
            </span>
          </label>

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? "Guardando..." : "Registrar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
