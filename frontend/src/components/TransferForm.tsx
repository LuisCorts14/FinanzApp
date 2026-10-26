import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createTransfer, updateTransfer } from "../api/transfers";
import type { Account, Transfer } from "../api/types";
import { formatMoney } from "../utils/format";

interface TransferFormProps {
  accounts: Account[];
  onSaved: () => void;
  onCancel: () => void;
  // Con una transferencia, el formulario la edita (las cuentas quedan fijas).
  transfer?: Transfer;
  defaultFromAccountId?: number;
  // P. ej. "Pagar tarjeta": la tarjeta queda como destino y el origen es otra cuenta.
  defaultToAccountId?: number;
}

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function accountLabel(a: Account): string {
  return `${a.name} (${formatMoney(a.balance, a.currency)})`;
}

// Mover plata entre cuentas propias: pagar la tarjeta, ahorrar, sacar efectivo... No es ingreso ni gasto.
export default function TransferForm({
  accounts,
  onSaved,
  onCancel,
  transfer,
  defaultFromAccountId,
  defaultToAccountId,
}: TransferFormProps) {
  const isEdit = Boolean(transfer);
  // Origen por defecto: el indicado, o la primera cuenta que no sea el destino (mejor si no es una tarjeta).
  const others = accounts.filter((a) => a.id !== defaultToAccountId);
  const firstId = String(
    transfer?.from_account_id ??
      defaultFromAccountId ??
      (others.find((a) => a.type !== "credit_card") ?? others[0] ?? accounts[0])?.id ??
      "",
  );
  const [fromId, setFromId] = useState(firstId);
  const [toId, setToId] = useState(
    String(transfer?.to_account_id ?? defaultToAccountId ?? accounts.find((a) => String(a.id) !== firstId)?.id ?? ""),
  );
  const [amount, setAmount] = useState(transfer ? String(transfer.amount) : "");
  const [toAmount, setToAmount] = useState(transfer ? String(transfer.to_amount) : "");
  const [description, setDescription] = useState(transfer?.description ?? "");
  const [date, setDate] = useState(transfer?.date ?? todayISO());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si las cuentas llegaron después de abrir el formulario, se completan origen y destino.
  useEffect(() => {
    if (fromId || accounts.length < 2) return;
    setFromId(firstId);
    setToId(String(defaultToAccountId ?? accounts.find((a) => String(a.id) !== firstId)?.id ?? ""));
  }, [accounts, fromId, firstId, defaultToAccountId]);

  if (accounts.length < 2) {
    return (
      <p className="modal-empty">
        Para transferir necesitas al menos dos cuentas, por ejemplo tu CuentaRUT y tu tarjeta.{" "}
        <Link to="/cuentas">Agregar cuenta</Link>
      </p>
    );
  }

  const from = accounts.find((a) => String(a.id) === fromId);
  const to = accounts.find((a) => String(a.id) === toId);
  const sameAccount = fromId === toId;
  const crossCurrency = Boolean(from && to && from.currency !== to.currency);
  const payingCard = to?.type === "credit_card";

  function changeFrom(value: string) {
    setFromId(value);
    // Si coincide con el destino, se mueve el destino a otra cuenta.
    if (value === toId) setToId(String(accounts.find((a) => String(a.id) !== value)?.id ?? ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to || sameAccount || !amount) return;
    setSubmitting(true);
    setError(null);
    const fields = {
      amount: Number(amount),
      to_amount: crossCurrency ? Number(toAmount) : null,
      description: description.trim() || null,
      date,
    };
    try {
      if (transfer) await updateTransfer(transfer.id, fields);
      else await createTransfer({ ...fields, from_account_id: from.id, to_account_id: to.id });
      onSaved();
      onCancel();
    } catch {
      setError("No se pudo guardar la transferencia. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <div className="modal-grid">
        <label>
          Desde
          {isEdit ? (
            <input value={from?.name ?? "—"} disabled />
          ) : (
            <select value={fromId} onChange={(e) => changeFrom(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </select>
          )}
        </label>
        <label>
          Hacia
          {isEdit ? (
            <input value={to?.name ?? "—"} disabled />
          ) : (
            <select value={toId} onChange={(e) => setToId(e.target.value)}>
              {accounts
                .filter((a) => String(a.id) !== fromId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </option>
                ))}
            </select>
          )}
        </label>
      </div>

      <label>
        Monto{crossCurrency && from ? ` que sale (${from.currency})` : ""}
        <input
          type="number"
          min="1"
          step={from?.currency === "CLP" ? "1" : "0.01"}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          required
          autoFocus
        />
      </label>

      {crossCurrency && to && (
        <label>
          Monto que llega ({to.currency})
          <input
            type="number"
            min="0.01"
            step={to.currency === "CLP" ? "1" : "0.01"}
            inputMode="decimal"
            value={toAmount}
            onChange={(e) => setToAmount(e.target.value)}
            placeholder="0"
            required
          />
          <span className="field-hint">Las cuentas usan distinta moneda: anota lo que realmente llegó.</span>
        </label>
      )}

      <div className="modal-grid">
        <label>
          Descripción
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={payingCard ? "Ej. Pago de la tarjeta" : "Ej. Ahorro del mes"}
            maxLength={255}
          />
        </label>
        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>

      <p className="transfer-hint">
        {payingCard
          ? `Pagar la tarjeta reduce su deuda. Como el dinero solo se mueve entre tus cuentas, no cuenta como gasto: el gasto ya lo registraste al comprar.`
          : "Una transferencia solo mueve plata entre tus cuentas: no cuenta como ingreso ni como gasto en tus reportes."}
      </p>

      {error && <p className="error">{error}</p>}

      <div className="modal-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={submitting || sameAccount || !to}>
          {submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Transferir"}
        </button>
      </div>
    </form>
  );
}
