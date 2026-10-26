import { useEffect, useState } from "react";
import { updateAccount } from "../api/accounts";
import { createDebt, updateDebt } from "../api/debts";
import type { DebtKind, PlanDebt } from "../api/types";
import { apiErrorDetail } from "../utils/apiError";
import { DEBT_KIND_LABELS, DEBT_KINDS } from "../utils/debts";
import { formatCLP } from "../utils/format";
import { CloseIcon } from "./Icons";

interface DebtFormModalProps {
  // Sin deuda: crear una nueva. Con una tarjeta: solo se editan la tasa y el pago mínimo de la cuenta.
  debt?: PlanDebt;
  onClose: () => void;
  onSaved: () => void;
}

function toInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export default function DebtFormModal({ debt, onClose, onSaved }: DebtFormModalProps) {
  const isCard = debt?.source === "card";
  const [name, setName] = useState(debt?.name ?? "");
  const [kind, setKind] = useState<DebtKind>(debt && debt.kind !== "credit_card" ? debt.kind : "consumer_loan");
  const [balance, setBalance] = useState(toInput(debt?.balance));
  const [rate, setRate] = useState(toInput(debt?.interest_rate));
  const [minimum, setMinimum] = useState(toInput(debt?.minimum_payment));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const rateNumber = Number(rate.replace(",", "."));
  const balanceNumber = isCard ? (debt?.balance ?? 0) : Number(balance);
  const monthlyInterest = rate && balanceNumber ? Math.round((balanceNumber * rateNumber) / 100) : null;
  const minimumTooLow = monthlyInterest !== null && minimum !== "" && Number(minimum) <= monthlyInterest;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rate === "" || minimum === "" || Number.isNaN(rateNumber)) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isCard && debt) {
        await updateAccount(debt.id, { interest_rate: rateNumber, minimum_payment: Number(minimum) });
      } else {
        const payload = {
          name: name.trim(),
          kind,
          balance: Number(balance),
          interest_rate: rateNumber,
          minimum_payment: Number(minimum),
        };
        if (debt) await updateDebt(debt.id, payload);
        else await createDebt(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorDetail(err) ?? "No se pudo guardar. Revisa los datos e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = isCard ? `Datos de ${debt?.name}` : debt ? "Editar deuda" : "Agregar deuda";

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-form-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="debt-form-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {isCard ? (
            <p className="field-hint">
              La deuda de esta tarjeta es su saldo: <strong>{formatCLP(debt?.balance ?? 0)}</strong>. Se actualiza sola
              con tus gastos y pagos.
            </p>
          ) : (
            <>
              <label>
                ¿Cómo se llama esta deuda?
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Crédito BancoEstado, Avance Falabella"
                  maxLength={100}
                  required
                  autoFocus
                />
              </label>
              <div className="modal-grid">
                <label>
                  Tipo
                  <select value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
                    {DEBT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {DEBT_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ¿Cuánto debes hoy?
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="0"
                    required
                  />
                </label>
              </div>
            </>
          )}

          <div className="modal-grid">
            <label>
              Tasa de interés mensual (%)
              <input
                type="number"
                min="0"
                max="20"
                step="0.01"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="Ej. 2,5"
                required
                autoFocus={isCard}
              />
            </label>
            <label>
              Pago mínimo al mes
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
                placeholder="0"
                required
              />
            </label>
          </div>
          <span className="field-hint">
            Las dos aparecen en tu estado de cuenta o en la app del banco. Usa la tasa <strong>mensual</strong>, no la
            anual (CAE). Si es un préstamo sin intereses, pon 0.
            {monthlyInterest !== null && monthlyInterest > 0 && (
              <> Con esa tasa, este mes se suman {formatCLP(monthlyInterest)} de intereses.</>
            )}
          </span>
          {minimumTooLow && (
            <p className="field-hint field-hint-error">
              Ese pago mínimo no alcanza a cubrir los intereses: si pagas solo eso, la deuda nunca baja.
            </p>
          )}

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
