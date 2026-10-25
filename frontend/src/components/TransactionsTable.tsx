import type { Transaction } from "../api/types";
import { formatCLP, formatShortDate } from "../utils/format";
import { CloseIcon, PencilIcon } from "./Icons";

interface TransactionsTableProps {
  transactions: Transaction[];
  // Si se pasa, se muestra la columna "Cuenta".
  accountNameById?: Map<number, string>;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  emptyMessage?: string;
}

export default function TransactionsTable({
  transactions,
  accountNameById,
  onEdit,
  onDelete,
  emptyMessage = "No hay transacciones para mostrar.",
}: TransactionsTableProps) {
  if (transactions.length === 0) return <p className="empty-state">{emptyMessage}</p>;

  const hasActions = Boolean(onEdit || onDelete);

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Categoría</th>
            {accountNameById && <th className="col-account">Cuenta</th>}
            <th>Fecha</th>
            <th className="align-right">Monto</th>
            {hasActions && <th aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const isIncome = tx.category.type === "income";
            const label = tx.description || tx.category.name;
            return (
              <tr key={tx.id}>
                <td className="cell-strong">{label}</td>
                <td>
                  <span className={`chip${isIncome ? " chip-income" : ""}`}>{tx.category.name}</span>
                </td>
                {accountNameById && (
                  <td className="cell-muted col-account">{accountNameById.get(tx.account_id) ?? "—"}</td>
                )}
                <td className="cell-muted">{formatShortDate(tx.date)}</td>
                <td className={`align-right ${isIncome ? "amount-income" : "amount-expense"}`}>
                  {isIncome ? "+" : "-"}
                  {formatCLP(tx.amount)}
                </td>
                {hasActions && (
                  <td className="row-actions">
                    {onEdit && (
                      <button
                        type="button"
                        className="icon-button icon-button-sm"
                        aria-label={`Editar ${label}`}
                        title="Editar"
                        onClick={() => onEdit(tx)}
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
                        onClick={() => onDelete(tx)}
                      >
                        <CloseIcon />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
