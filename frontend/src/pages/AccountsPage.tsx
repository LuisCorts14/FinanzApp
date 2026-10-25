import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteAccount, listAccounts } from "../api/accounts";
import { listInstitutions } from "../api/catalog";
import type { Institution } from "../api/catalog";
import type { Account, AccountType } from "../api/types";
import AccountFormModal from "../components/AccountFormModal";
import { PlusIcon, WalletIcon } from "../components/Icons";
import InstitutionBadge from "../components/InstitutionBadge";
import { formatCLP, formatMoney } from "../utils/format";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Efectivo",
  bank: "Cuenta bancaria",
  credit_card: "Tarjeta de crédito",
  savings: "Ahorro",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function loadAccounts() {
    setError(null);
    try {
      setAccounts(await listAccounts());
    } catch {
      setError("No se pudo conectar con la API. ¿Está corriendo el backend?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
    listInstitutions()
      .then(setInstitutions)
      .catch(() => setInstitutions([]));
  }, []);

  const colorById = useMemo(() => new Map(institutions.map((i) => [i.id, i.color])), [institutions]);
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance_base, 0);

  async function handleDelete(account: Account) {
    const ok = window.confirm(
      `¿Eliminar "${account.name}"? También se borrarán todos sus movimientos. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    await deleteAccount(account.id);
    await loadAccounts();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Saldo total: {formatCLP(totalBalance)}</p>
          <h1>Mis cuentas</h1>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-primary" onClick={() => setModalOpen(true)}>
            <PlusIcon />
            Nueva cuenta
          </button>
        </div>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && accounts.length === 0 && (
        <div className="card onboarding-card">
          <h2>Agrega tu primera cuenta</h2>
          <p>
            Una cuenta es cualquier lugar donde tienes dinero: tu CuentaRUT, una tarjeta de crédito o el efectivo de tu
            billetera.
          </p>
        </div>
      )}

      {!loading && !error && accounts.length > 0 && (
        <div className="account-grid">
          {accounts.map((account) => {
            const subtitle = account.institution_name
              ? [account.institution_name, account.product_name].filter(Boolean).join(" · ")
              : ACCOUNT_TYPE_LABELS[account.type];
            const isDebt = account.type === "credit_card" && account.balance < 0;
            return (
              <div key={account.id} className="account-card">
                <Link to={`/accounts/${account.id}`} className="account-link">
                  <div className="account-card-top">
                    {account.institution_name ? (
                      <InstitutionBadge
                        name={account.institution_name}
                        color={colorById.get(account.institution_id ?? "")}
                      />
                    ) : (
                      <span className="institution-badge institution-badge-md institution-badge-cash">
                        <WalletIcon />
                      </span>
                    )}
                    <span className="chip">{ACCOUNT_TYPE_LABELS[account.type]}</span>
                  </div>
                  <h3>{account.name}</h3>
                  {subtitle !== account.name && <p className="account-type">{subtitle}</p>}
                  <p className={`balance${isDebt ? " amount-expense" : ""}`}>
                    {formatMoney(account.balance, account.currency)}
                  </p>
                  {isDebt && <p className="account-type">Deuda de la tarjeta</p>}
                  {account.currency !== "CLP" && <p className="account-type">≈ {formatCLP(account.balance_base)}</p>}
                </Link>
                <button className="link-button account-delete" onClick={() => handleDelete(account)}>
                  Eliminar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && <AccountFormModal onClose={() => setModalOpen(false)} onCreated={loadAccounts} />}
    </div>
  );
}
