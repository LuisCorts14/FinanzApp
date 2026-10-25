import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listAccounts } from "../api/accounts";
import { listCategories } from "../api/categories";
import { deleteTransaction, listTransactions } from "../api/transactions";
import type { Account, Category, Transaction, TransactionType } from "../api/types";
import { PlusIcon } from "../components/Icons";
import MonthPicker from "../components/MonthPicker";
import TransactionFormModal from "../components/TransactionFormModal";
import TransactionsTable from "../components/TransactionsTable";
import { formatCLP } from "../utils/format";
import { getCurrentMonthKey, monthName } from "../utils/month";

type Filter = "all" | TransactionType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Gastos" },
];

export default function MovementsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState(getCurrentMonthKey());
  const [searchParams, setSearchParams] = useSearchParams();
  const rawQuery = searchParams.get("q") ?? "";
  const query = rawQuery.trim().toLowerCase();

  // null = modal cerrado; "new" = crear; una transacción = editarla.
  const [modal, setModal] = useState<"new" | Transaction | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [transactionsData, accountsData, categoriesData] = await Promise.all([
        listTransactions(undefined, month),
        listAccounts(),
        listCategories(),
      ]);
      setTransactions(transactionsData);
      setAccounts(accountsData);
      setCategories(categoriesData);
    } catch {
      setError("No se pudo conectar con la API.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const filtered = useMemo(() => {
    let rows = filter === "all" ? transactions : transactions.filter((t) => t.category.type === filter);
    if (query) {
      rows = rows.filter(
        (t) => (t.description ?? "").toLowerCase().includes(query) || t.category.name.toLowerCase().includes(query),
      );
    }
    return [...rows].sort((a, b) =>
      a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date),
    );
  }, [transactions, filter, query]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.category.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  async function handleDelete(tx: Transaction) {
    const label = tx.description || tx.category.name;
    if (!window.confirm(`¿Eliminar "${label}" por ${formatCLP(tx.amount)}? El saldo de la cuenta se ajustará.`)) return;
    await deleteTransaction(tx.id);
    await loadData();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Todos tus ingresos y gastos, de todas tus cuentas</p>
          <h1>Transacciones</h1>
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
          <button type="button" className="button-primary" onClick={() => setModal("new")}>
            <PlusIcon />
            Nueva transacción
          </button>
        </div>
      </div>

      {!loading && !error && accounts.length === 0 && (
        <div className="card onboarding-card">
          <h2>Aún no tienes cuentas</h2>
          <p>
            Cada transacción sale de una cuenta (tu banco, tarjeta o efectivo).{" "}
            <Link to="/cuentas">Crea la primera</Link>.
          </p>
        </div>
      )}

      <div className="summary-strip">
        <div className="summary-item">
          <span className="summary-label">Ingresos</span>
          <span className="summary-value amount-income">+{formatCLP(totals.income)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Gastos</span>
          <span className="summary-value amount-expense">-{formatCLP(totals.expense)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Diferencia</span>
          <span className={`summary-value ${totals.net < 0 ? "amount-expense" : ""}`}>{formatCLP(totals.net)}</span>
        </div>
      </div>

      <section className="card">
        <div className="card-header card-header-wrap">
          <div className="segmented segmented-inline" role="tablist" aria-label="Filtrar por tipo">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                className={filter === f.value ? "active" : ""}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="cell-muted">
            {filtered.length} {filtered.length === 1 ? "transacción" : "transacciones"} en {monthName(month)}
          </span>
        </div>

        {query && (
          <p className="search-note">
            Buscando “{rawQuery}” en {monthName(month, true)}.{" "}
            <button type="button" className="link-button-muted" onClick={() => setSearchParams({})}>
              Quitar búsqueda
            </button>
          </p>
        )}

        {loading && <p>Cargando...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <TransactionsTable
            transactions={filtered}
            accountNameById={accountNameById}
            onEdit={(tx) => setModal(tx)}
            onDelete={handleDelete}
            emptyMessage={
              query ? "Ninguna transacción coincide con tu búsqueda." : `No hay transacciones en ${monthName(month)}.`
            }
          />
        )}
      </section>

      {modal && (
        <TransactionFormModal
          accounts={accounts}
          categories={categories}
          transaction={modal === "new" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
