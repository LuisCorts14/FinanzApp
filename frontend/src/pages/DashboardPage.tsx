import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAccounts } from "../api/accounts";
import { listCategories } from "../api/categories";
import { getExpensesByCategory, getMonthlySummary, getWeeklySummary } from "../api/stats";
import type { CategoryTotal, MonthlySummary, WeeklySummary } from "../api/stats";
import { listTransactions } from "../api/transactions";
import type { Account, Category, Transaction } from "../api/types";
import { ArrowDownRightIcon, ArrowUpRightIcon, PlusIcon, WalletIcon } from "../components/Icons";
import MonthPicker from "../components/MonthPicker";
import TransactionFormModal from "../components/TransactionFormModal";
import TransactionsTable from "../components/TransactionsTable";
import CategoryDonutCard from "../components/charts/CategoryDonutCard";
import WeeklyBarsChart from "../components/charts/WeeklyBarsChart";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/settingsContext";
import { formatCLP, formatShortDate, percentChange } from "../utils/format";
import { getCurrentMonthKey, monthName, shiftMonth } from "../utils/month";
import { daysUntilPayday, nextPayday } from "../utils/payday";
import { toISODate } from "../utils/savings";

function DeltaText({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value === null) return <span className="kpi-delta kpi-delta-neutral">Sin datos del mes anterior</span>;
  const rounded = Math.round(value);
  const isGood = rounded === 0 ? true : rounded > 0 === goodWhenUp;
  return (
    <span className={`kpi-delta ${isGood ? "kpi-delta-good" : "kpi-delta-bad"}`}>
      {rounded > 0 ? "+" : ""}
      {rounded}% vs. mes anterior
    </span>
  );
}

function savingsMessage(income: number, balance: number, target: number): string {
  if (income === 0 && balance === 0) return "Registra tus ingresos para ver cuánto ahorras";
  if (income === 0) return "Aún no registras ingresos este mes";
  if (balance < 0) return `Gastaste ${formatCLP(-balance)} más de lo que ganaste`;
  const rate = Math.round((balance / income) * 100);
  if (target > 0 && rate >= target) return `Ahorras el ${rate}% de tus ingresos: ¡cumples tu meta del ${target}%!`;
  if (target > 0) return `Ahorras el ${rate}% de tus ingresos · tu meta es ${target}%`;
  return `Ahorras el ${rate}% de tus ingresos`;
}

// Cuánto se puede gastar por día hasta el próximo sueldo, con lo que queda del mes.
function PaydayTip({ payday, balance }: { payday: number | null; balance: number }) {
  if (!payday) {
    return (
      <div className="tip-card tip-card-muted">
        <strong>¿Cuándo te pagan?</strong> Configura tu <Link to="/configuracion">día de pago</Link> y te diremos cuánto
        puedes gastar por día hasta el próximo sueldo.
      </div>
    );
  }
  const days = daysUntilPayday(payday);
  const when = formatShortDate(toISODate(nextPayday(payday)));
  const countdown = days === 1 ? "Falta 1 día" : `Faltan ${days} días`;
  if (balance <= 0) {
    return (
      <div className="tip-card tip-card-warning">
        <strong>
          {countdown} para tu sueldo ({when}).
        </strong>{" "}
        Este mes ya gastaste todo lo que entró: evita gastos que no sean necesarios hasta entonces.
      </div>
    );
  }
  return (
    <div className="tip-card">
      <strong>
        {countdown} para tu sueldo ({when}).
      </strong>{" "}
      Para no gastar más de lo que te entró este mes, puedes gastar hasta <strong>{formatCLP(balance / days)}</strong>{" "}
      por día.
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [month, setMonth] = useState(getCurrentMonthKey());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthly, setMonthly] = useState<MonthlySummary[]>([]);
  const [weekly, setWeekly] = useState<WeeklySummary[]>([]);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountsData, categoriesData, monthlyData, weeklyData, byCategoryData, transactionsData] =
        await Promise.all([
          listAccounts(),
          listCategories(),
          getMonthlySummary(),
          getWeeklySummary(month),
          getExpensesByCategory(month),
          listTransactions(undefined, month),
        ]);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setMonthly(monthlyData);
      setWeekly(weeklyData);
      setByCategory(byCategoryData);
      setTransactions(transactionsData);
    } catch {
      setError("No se pudo conectar con la API.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)))
        .slice(0, 5),
    [transactions],
  );

  const current = monthly.find((m) => m.month === month);
  const previous = monthly.find((m) => m.month === shiftMonth(month, -1));
  const income = current?.income ?? 0;
  const expense = current?.expense ?? 0;
  const balance = income - expense;

  const firstName = (user?.full_name || user?.email.split("@")[0] || "").split(" ")[0];

  return (
    <div className="page dashboard">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Hola, {firstName}</p>
          <h1>Resumen de {monthName(month)}</h1>
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
          <button type="button" className="button-primary" onClick={() => setModalOpen(true)}>
            <PlusIcon />
            Nueva transacción
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!loading && !error && accounts.length === 0 && (
        <div className="card onboarding-card">
          <h2>Empecemos por lo básico</h2>
          <p>Para saber a dónde se va tu dinero, sigue estos 3 pasos:</p>
          <ol>
            <li>
              <Link to="/cuentas">Crea una cuenta</Link> (tu banco, efectivo o tarjeta).
            </li>
            <li>
              <Link to="/categories">Define tus categorías</Link> de gasto, como Comida o Transporte.
            </li>
            <li>Registra cada ingreso y gasto con el botón “Nueva transacción”.</li>
          </ol>
        </div>
      )}

      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-header">
            <span>Ingresos</span>
            <span className="kpi-icon kpi-icon-income">
              <ArrowUpRightIcon />
            </span>
          </div>
          <div className="kpi-value">{loading ? <span className="skeleton skeleton-value" /> : formatCLP(income)}</div>
          {loading ? (
            <span className="skeleton skeleton-line" />
          ) : (
            <DeltaText value={previous ? percentChange(income, previous.income) : null} goodWhenUp />
          )}
        </div>
        <div className="kpi-card">
          <div className="kpi-header">
            <span>Gastos</span>
            <span className="kpi-icon kpi-icon-expense">
              <ArrowDownRightIcon />
            </span>
          </div>
          <div className="kpi-value">{loading ? <span className="skeleton skeleton-value" /> : formatCLP(expense)}</div>
          {loading ? (
            <span className="skeleton skeleton-line" />
          ) : (
            <DeltaText value={previous ? percentChange(expense, previous.expense) : null} goodWhenUp={false} />
          )}
        </div>
        <div className="kpi-card kpi-card-dark">
          <div className="kpi-header">
            <span>Balance</span>
            <span className="kpi-icon kpi-icon-dark">
              <WalletIcon />
            </span>
          </div>
          <div className="kpi-value">
            {loading ? <span className="skeleton skeleton-value skeleton-dark" /> : formatCLP(balance)}
          </div>
          <span
            className={`kpi-delta ${
              balance < 0 || (income > 0 && (balance / income) * 100 < settings.savings_target_pct)
                ? "kpi-delta-warn"
                : "kpi-delta-accent"
            }`}
          >
            {loading ? "Cargando tu mes..." : savingsMessage(income, balance, settings.savings_target_pct)}
          </span>
        </div>
      </div>

      {!loading && month === getCurrentMonthKey() && accounts.length > 0 && (
        <PaydayTip payday={settings.payday} balance={balance} />
      )}

      <div className="dash-grid">
        <section className="card">
          <div className="card-header">
            <h2>Gastos por categoría</h2>
            <Link to="/estadisticas" className="card-link">
              Ver todo
            </Link>
          </div>
          {!loading && <CategoryDonutCard data={byCategory} />}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Ingresos vs. gastos por semana</h2>
            <div className="chart-legend">
              <span>
                <span className="legend-dot legend-dot-income" /> Ingresos
              </span>
              <span>
                <span className="legend-dot legend-dot-expense" /> Gastos
              </span>
            </div>
          </div>
          {!loading && <WeeklyBarsChart data={weekly} />}
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Últimas transacciones</h2>
          <Link to="/movimientos" className="card-link">
            Ver todas
          </Link>
        </div>
        {!loading && (
          <TransactionsTable transactions={latest} emptyMessage={`No hay transacciones en ${monthName(month)}.`} />
        )}
      </section>

      {modalOpen && (
        <TransactionFormModal
          accounts={accounts}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
