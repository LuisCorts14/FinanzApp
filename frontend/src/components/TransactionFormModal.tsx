import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createTransaction, updateTransaction } from "../api/transactions";
import type { Account, Category, Transaction, TransactionType, Transfer } from "../api/types";
import { CloseIcon } from "./Icons";
import TransferForm from "./TransferForm";

interface TransactionFormModalProps {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  // Con una transacción, el modal la edita en vez de crear una nueva.
  transaction?: Transaction;
  // Con una transferencia, el modal la edita.
  transfer?: Transfer;
  // Deja la cuenta fija (p. ej. al abrirlo desde el detalle de una cuenta).
  fixedAccountId?: number;
  // Abre directamente en "Transferencia" con este destino (p. ej. "Pagar tarjeta").
  transferToAccountId?: number;
}

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function TransactionFormModal({
  accounts,
  categories,
  onClose,
  onSaved,
  transaction,
  transfer,
  fixedAccountId,
  transferToAccountId,
}: TransactionFormModalProps) {
  const isEdit = Boolean(transaction || transfer);
  const initialType: TransactionType = transaction?.category.type ?? "expense";
  const firstOfType = (t: TransactionType) => String(categories.find((c) => c.type === t)?.id ?? "");

  const [isTransfer, setIsTransfer] = useState(Boolean(transfer || transferToAccountId));
  const [type, setType] = useState<TransactionType>(initialType);
  const [accountId, setAccountId] = useState(
    String(transaction?.account_id ?? fixedAccountId ?? accounts[0]?.id ?? ""),
  );
  const [categoryId, setCategoryId] = useState(
    transaction ? String(transaction.category.id) : firstOfType(initialType),
  );
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriesOfType = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  // La cuenta no se puede cambiar al editar (el balance de ambas cuentas tendría que recalcularse).
  const accountLocked = isEdit || fixedAccountId !== undefined;
  const lockedAccount = accounts.find((a) => String(a.id) === accountId);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function selectType(t: TransactionType) {
    setIsTransfer(false);
    setType(t);
    setCategoryId(firstOfType(t));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !categoryId || !amount) return;
    setSubmitting(true);
    setError(null);
    const fields = {
      category_id: Number(categoryId),
      amount: Number(amount),
      description: description.trim() || null,
      date,
    };
    try {
      if (transaction) await updateTransaction(transaction.id, fields);
      else await createTransaction({ ...fields, account_id: Number(accountId) });
      onSaved();
      onClose();
    } catch {
      setError("No se pudo guardar la transacción. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  const missingSetup = accounts.length === 0 || categories.length === 0;
  const title = transfer
    ? "Editar transferencia"
    : isEdit
      ? "Editar transacción"
      : transferToAccountId
        ? "Pagar tarjeta"
        : "Nueva transacción";

  // Al editar no se cambia de tipo: una transacción no se convierte en transferencia ni al revés.
  const tabs = [
    { key: "expense", label: "Gasto", active: !isTransfer && type === "expense", onClick: () => selectType("expense") },
    { key: "income", label: "Ingreso", active: !isTransfer && type === "income", onClick: () => selectType("income") },
    ...(isEdit
      ? []
      : [{ key: "transfer", label: "Transferencia", active: isTransfer, onClick: () => setIsTransfer(true) }]),
  ];

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="transaction-modal-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {!transfer && (
          <div
            className={`segmented segmented-modal${tabs.length === 3 ? " segmented-3" : ""}`}
            role="tablist"
            aria-label="Tipo de movimiento"
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={t.active}
                className={t.active ? "active" : ""}
                onClick={t.onClick}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {isTransfer ? (
          <TransferForm
            accounts={accounts}
            transfer={transfer}
            defaultFromAccountId={transferToAccountId ? undefined : fixedAccountId}
            defaultToAccountId={transferToAccountId}
            onSaved={onSaved}
            onCancel={onClose}
          />
        ) : missingSetup ? (
          <p className="modal-empty">
            {accounts.length === 0 ? (
              <>
                Primero necesitas una cuenta donde registrar tu dinero. <Link to="/cuentas">Crear cuenta</Link>
              </>
            ) : (
              <>
                Primero crea al menos una categoría. <Link to="/categories">Crear categoría</Link>
              </>
            )}
          </p>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <label>
              Monto
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                required
                autoFocus
              />
            </label>

            <label>
              Descripción
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={type === "expense" ? "Ej. Supermercado" : "Ej. Sueldo"}
              />
            </label>

            <div className="modal-grid">
              <label>
                Categoría
                {categoriesOfType.length === 0 ? (
                  <span className="field-hint">
                    No tienes categorías de {type === "expense" ? "gasto" : "ingreso"}.{" "}
                    <Link to="/categories">Crear una</Link>
                  </span>
                ) : (
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    {categoriesOfType.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label>
                Cuenta
                {accountLocked ? (
                  <input value={lockedAccount?.name ?? "—"} disabled />
                ) : (
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>

            <label>
              Fecha
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>

            {error && <p className="error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" disabled={submitting || !categoryId}>
                {submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
