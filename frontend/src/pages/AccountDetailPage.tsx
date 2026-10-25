import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAccount, listAccounts } from "../api/accounts";
import { listInstitutions } from "../api/catalog";
import { listCategories } from "../api/categories";
import { deleteTransaction, listTransactions } from "../api/transactions";
import type { Account, Category, Transaction } from "../api/types";
import { ChevronLeftIcon, PlusIcon, WalletIcon } from "../components/Icons";
import AccountFormModal from "../components/AccountFormModal";
import CreditUsageBar from "../components/CreditUsageBar";
import InstitutionBadge from "../components/InstitutionBadge";
import TransactionFormModal from "../components/TransactionFormModal";
import TransactionsTable from "../components/TransactionsTable";
import { creditUsage } from "../utils/credit";
import { formatCLP, formatMoney } from "../utils/format";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);

  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [institutionColor, setInstitutionColor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"new" | Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [accountData, accountsData, transactionsData, categoriesData] = await Promise.all([
        getAccount(accountId),
        listAccounts(),
        listTransactions(accountId),
        listCategories(),
      ]);
      setAccount(accountData);
      setAccounts(accountsData);
      setTransactions(transactionsData);
      setCategories(categoriesData);
    } catch {
      setError("No se pudo cargar la cuenta.");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!account?.institution_id) return;
    listInstitutions()
      .then((list) => setInstitutionColor(list.find((i) => i.id === account.institution_id)?.color))
      .catch(() => setInstitutionColor(undefined));
  }, [account?.institution_id]);

  const sorted = useMemo(
    () =>
      [...transactions].sort((a, b) =>
        a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date),
      ),
    [transactions],
  );

  async function handleDelete(tx: Transaction) {
    const label = tx.description || tx.category.name;
    if (!window.confirm(`¿Eliminar "${label}" por ${formatCLP(tx.amount)}? El saldo de la cuenta se ajustará.`)) return;
    await deleteTransaction(tx.id);
    await loadData();
  }

  if (loading) return <div className="page">Cargando...</div>;
  if (error || !account) return <div className="page error">{error ?? "Cuenta no encontrada"}</div>;

  const isDebt = account.type === "credit_card" && account.balance < 0;
  const usage = creditUsage(account);
  const subtitle = [account.institution_name, account.product_name].filter(Boolean).join(" · ");

  return (
    <div className="page">
      <Link to="/cuentas" className="back-link back-link-icon">
        <ChevronLeftIcon /> Mis cuentas
      </Link>

      <div className="page-header">
        <div className="account-heading">
          {account.institution_name ? (
            <InstitutionBadge name={account.institution_name} color={institutionColor} />
          ) : (
            <span className="institution-badge institution-badge-md institution-badge-cash">
              <WalletIcon />
            </span>
          )}
          <div>
            {subtitle && subtitle !== account.name && <p className="page-eyebrow">{subtitle}</p>}
            <h1>{account.name}</h1>
          </div>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary button-header" onClick={() => setEditingAccount(true)}>
            Editar cuenta
          </button>
          <button type="button" className="button-primary" onClick={() => setModal("new")}>
            <PlusIcon />
            Nueva transacción
          </button>
        </div>
      </div>

      <div className={`kpi-row ${usage ? "kpi-row-double" : "kpi-row-single"}`}>
        <div className="kpi-card">
          <div className="kpi-header">{isDebt ? "Deuda de la tarjeta" : "Saldo actual"}</div>
          <div className={`kpi-value${isDebt ? " amount-expense" : ""}`}>
            {formatMoney(account.balance, account.currency)}
          </div>
          <span className="kpi-delta kpi-delta-neutral">
            {account.currency !== "CLP"
              ? `≈ ${formatCLP(account.balance_base)}`
              : account.type === "credit_card"
                ? "Cada compra con la tarjeta la aumenta; cada pago la reduce"
                : "Se actualiza solo con cada ingreso y gasto"}
          </span>
        </div>
        {usage && (
          <div className="kpi-card">
            <div className="kpi-header">Cupo de la tarjeta</div>
            <div className="kpi-value">{formatCLP(usage.limit)}</div>
            <CreditUsageBar usage={usage} />
          </div>
        )}
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Transacciones de esta cuenta</h2>
          <span className="cell-muted">{transactions.length} en total</span>
        </div>
        <TransactionsTable
          transactions={sorted}
          onEdit={(tx) => setModal(tx)}
          onDelete={handleDelete}
          emptyMessage="Todavía no hay transacciones en esta cuenta."
        />
      </section>

      {editingAccount && (
        <AccountFormModal account={account} onClose={() => setEditingAccount(false)} onSaved={loadData} />
      )}

      {modal && (
        <TransactionFormModal
          accounts={accounts}
          categories={categories}
          fixedAccountId={account.id}
          transaction={modal === "new" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
