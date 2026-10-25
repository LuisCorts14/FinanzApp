import { useEffect, useState } from "react";
import { listAccounts } from "../api/accounts";
import { getBudgetStatus, getExpensesByCategory, getMonthlySummary } from "../api/stats";
import type { BudgetStatus, CategoryTotal, MonthlySummary } from "../api/stats";
import type { Account } from "../api/types";
import BudgetsCard from "../components/BudgetsCard";
import MonthPicker from "../components/MonthPicker";
import ExpensesByCategoryChart from "../components/charts/ExpensesByCategoryChart";
import MonthlyDivergingChart from "../components/charts/MonthlyDivergingChart";
import { formatCLP } from "../utils/format";
import { getCurrentMonthKey, monthName } from "../utils/month";

export default function StatsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<CategoryTotal[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(getCurrentMonthKey());

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const [accountsData, expensesData, monthlyData, budgetsData] = await Promise.all([
          listAccounts(),
          getExpensesByCategory(month),
          getMonthlySummary(),
          getBudgetStatus(month),
        ]);
        setAccounts(accountsData);
        setExpensesByCategory(expensesData);
        setMonthlySummary(monthlyData);
        setBudgets(budgetsData);
      } catch {
        setError("No se pudo conectar con la API.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [month]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance_base, 0);
  const selectedMonth = monthlySummary.find((m) => m.month === month);
  const monthIncome = selectedMonth?.income ?? 0;
  const monthExpense = selectedMonth?.expense ?? 0;
  const savingsRate = monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Mira tus números con calma</p>
          <h1>Reportes</h1>
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!error && (
        <>
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-header">Ingresos de {monthName(month)}</div>
              <div className="kpi-value">{formatCLP(monthIncome)}</div>
              <span className="kpi-delta kpi-delta-neutral">Lo que entró este mes</span>
            </div>
            <div className="kpi-card">
              <div className="kpi-header">Gastos de {monthName(month)}</div>
              <div className="kpi-value">{formatCLP(monthExpense)}</div>
              <span className="kpi-delta kpi-delta-neutral">Lo que salió este mes</span>
            </div>
            <div className="kpi-card kpi-card-dark">
              <div className="kpi-header">Saldo total en tus cuentas</div>
              <div className="kpi-value">{formatCLP(totalBalance)}</div>
              <span
                className={`kpi-delta ${savingsRate !== null && savingsRate < 0 ? "kpi-delta-warn" : "kpi-delta-accent"}`}
              >
                {savingsRate === null
                  ? "Registra tus ingresos para ver tu tasa de ahorro"
                  : savingsRate >= 0
                    ? `Este mes ahorraste el ${savingsRate}% de tus ingresos`
                    : `Este mes gastaste ${Math.abs(savingsRate)}% más de lo que ganaste`}
              </span>
            </div>
          </div>

          <div className="dash-grid">
            <section className="card">
              <div className="card-header">
                <h2>Presupuestos de {monthName(month)}</h2>
              </div>
              {!loading && <BudgetsCard data={budgets} />}
            </section>

            <section className="card">
              <div className="card-header">
                <h2>Gastos por categoría</h2>
              </div>
              {!loading && <ExpensesByCategoryChart data={expensesByCategory} />}
            </section>
          </div>

          <section className="card">
            <div className="card-header">
              <h2>Ingresos vs. gastos por mes</h2>
              <span className="cell-muted">Últimos 12 meses</span>
            </div>
            {!loading && <MonthlyDivergingChart data={monthlySummary} />}
          </section>
        </>
      )}
    </div>
  );
}
