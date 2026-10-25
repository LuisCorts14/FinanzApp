import type { Transaction, Transfer } from "../api/types";
import { formatCLP, formatShortDate } from "../utils/format";
import { CloseIcon, PencilIcon } from "./Icons";

interface TransactionsTableProps {
  transactions: Transaction[];
  transfers?: Transfer[];
  // Nombres de cuentas: para la columna "Cuenta" y para describir transferencias.
  accountNames?: Map<number, string>;
  showAccountColumn?: boolean;
  // Si la tabla muestra una sola cuenta, las transferencias se ven como entrada (+) o salida (-) de ella.
  contextAccountId?: number;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  onEditTransfer?: (t: Transfer) => void;
  onDeleteTransfer?: (t: Transfer) => void;
  emptyMessage?: string;
}

type Row = { kind: "tx"; item: Transaction } | { kind: "transfer"; item: Transfer };

function byNewest(a: Row, b: Row): number {
  if (a.item.date !== b.item.date) return b.item.date.localeCompare(a.item.date);
  return b.item.created_at.localeCompare(a.item.created_at);
}

function RowActions({ label, onEdit, onDelete }: { label: string; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <td className="row-actions">
      {onEdit && (
        <button
          type="button"
          className="icon-button icon-button-sm"
          aria-label={`Editar ${label}`}
          title="Editar"
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          className="icon-button icon-button-sm icon-button-danger"
          aria-label={`Eliminar ${label}`}
          title="Eliminar"
          onClick={onDelete}
        >
          <CloseIcon />
        </button>
      )}
    </td>
  );
}

export default function TransactionsTable({
  transactions,
  transfers = [],
  accountNames,
  showAccountColumn = false,
  contextAccountId,
  onEdit,
  onDelete,
  onEditTransfer,
  onDeleteTransfer,
  emptyMessage = "No hay transacciones para mostrar.",
}: TransactionsTableProps) {
  const rows: Row[] = [
    ...transactions.map((item): Row => ({ kind: "tx", item })),
    ...transfers.map((item): Row => ({ kind: "transfer", item })),
  ].sort(byNewest);

  if (rows.length === 0) return <p className="empty-state">{emptyMessage}</p>;

  const hasActions = Boolean(onEdit || onDelete || onEditTransfer || onDeleteTransfer);
  const nameOf = (id: number) => accountNames?.get(id) ?? "otra cuenta";

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Categoría</th>
            {showAccountColumn && <th className="col-account">Cuenta</th>}
            <th>Fecha</th>
            <th className="align-right">Monto</th>
            {hasActions && <th aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.kind === "tx") {
              const tx = row.item;
              const isIncome = tx.category.type === "income";
              const label = tx.description || tx.category.name;
              return (
                <tr key={`tx-${tx.id}`}>
                  <td className="cell-strong">{label}</td>
                  <td>
                    <span className={`chip${isIncome ? " chip-income" : ""}`}>{tx.category.name}</span>
                  </td>
                  {showAccountColumn && <td className="cell-muted col-account">{nameOf(tx.account_id)}</td>}
                  <td className="cell-muted">{formatShortDate(tx.date)}</td>
                  <td className={`align-right ${isIncome ? "amount-income" : "amount-expense"}`}>
                    {isIncome ? "+" : "-"}
                    {formatCLP(tx.amount)}
                  </td>
                  {hasActions && (
                    <RowActions
                      label={label}
                      onEdit={onEdit && (() => onEdit(tx))}
                      onDelete={onDelete && (() => onDelete(tx))}
                    />
                  )}
                </tr>
              );
            }

            const t = row.item;
            const incoming = contextAccountId !== undefined && t.to_account_id === contextAccountId;
            const outgoing = contextAccountId !== undefined && t.from_account_id === contextAccountId;
            const fallback = outgoing
              ? `Transferencia a ${nameOf(t.to_account_id)}`
              : incoming
                ? `Transferencia desde ${nameOf(t.from_account_id)}`
                : "Transferencia";
            const label = t.description || fallback;
            return (
              <tr key={`tr-${t.id}`} className="row-transfer">
                <td className="cell-strong">
                  {label}
                  {t.description && contextAccountId !== undefined && <span className="cell-sub">{fallback}</span>}
                </td>
                <td>
                  <span className="chip chip-transfer">Transferencia</span>
                </td>
                {showAccountColumn && (
                  <td className="cell-muted col-account">
                    {nameOf(t.from_account_id)} → {nameOf(t.to_account_id)}
                  </td>
                )}
                <td className="cell-muted">{formatShortDate(t.date)}</td>
                <td className="align-right amount-transfer">
                  {incoming ? `+${formatCLP(t.to_amount)}` : outgoing ? `-${formatCLP(t.amount)}` : formatCLP(t.amount)}
                </td>
                {hasActions && (
                  <RowActions
                    label={label}
                    onEdit={onEditTransfer && (() => onEditTransfer(t))}
                    onDelete={onDeleteTransfer && (() => onDeleteTransfer(t))}
                  />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
