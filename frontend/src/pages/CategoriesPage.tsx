import { useEffect, useMemo, useState } from "react";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../api/categories";
import { getBudgetStatus } from "../api/stats";
import type { BudgetStatus } from "../api/stats";
import type { Category, TransactionType } from "../api/types";
import CategoryFormModal from "../components/CategoryFormModal";
import { CloseIcon, PencilIcon, PlusIcon } from "../components/Icons";
import { budgetStatusFor } from "../utils/budget";
import { formatCLP } from "../utils/format";

const MAX_INCOME_CATEGORIES = 3;

const SUGGESTED_EXPENSE = [
  "Comida",
  "Transporte",
  "Salud",
  "Vivienda",
  "Servicios",
  "Entretenimiento",
  "Educación",
  "Compras",
];
const SUGGESTED_INCOME = ["Sueldo", "Negocio propio", "Otros ingresos"];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingBudget, setEditingBudget] = useState("");

  async function loadCategories() {
    setError(null);
    try {
      const [categoriesData, budgetsData] = await Promise.all([listCategories(), getBudgetStatus()]);
      setCategories(categoriesData);
      setBudgets(budgetsData);
    } catch {
      setError("No se pudo conectar con la API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeLimitReached = incomeCategories.length >= MAX_INCOME_CATEGORIES;
  const spentById = useMemo(() => new Map(budgets.map((b) => [b.category_id, b.spent])), [budgets]);

  const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
  const expenseSuggestions = SUGGESTED_EXPENSE.filter((n) => !existingNames.has(n.toLowerCase()));
  const incomeSuggestions = incomeLimitReached
    ? []
    : SUGGESTED_INCOME.filter((n) => !existingNames.has(n.toLowerCase()));

  async function handleQuickAdd(suggestedName: string, suggestedType: TransactionType) {
    setAddingSuggestion(suggestedName);
    try {
      await createCategory({ name: suggestedName, type: suggestedType });
      await loadCategories();
    } catch {
      // si falla (ya existe, límite alcanzado, etc.) simplemente no se agrega
    } finally {
      setAddingSuggestion(null);
    }
  }

  async function handleDelete(c: Category) {
    if (!window.confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
    try {
      await deleteCategory(c.id);
      await loadCategories();
    } catch {
      alert("No se puede eliminar: hay transacciones usando esta categoría.");
    }
  }

  function startEditBudget(c: Category) {
    setEditingId(c.id);
    setEditingBudget(c.monthly_budget != null ? String(c.monthly_budget) : "");
  }

  async function saveEditBudget(id: number) {
    await updateCategory(id, { monthly_budget: editingBudget ? Number(editingBudget) : null });
    setEditingId(null);
    await loadCategories();
  }

  function renderSuggestions(names: string[], type: TransactionType) {
    if (names.length === 0) return null;
    return (
      <div className="suggestions">
        <span className="suggestions-label">Sugerencias:</span>
        {names.map((n) => (
          <button
            key={n}
            type="button"
            className="suggestion-chip"
            disabled={addingSuggestion === n}
            onClick={() => handleQuickAdd(n, type)}
          >
            + {n}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Ordena en qué se va tu plata</p>
          <h1>Categorías</h1>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-primary" onClick={() => setModalOpen(true)}>
            <PlusIcon />
            Nueva categoría
          </button>
        </div>
      </div>

      <div className="tip-card">
        <strong>Consejo:</strong> una guía simple es la regla 50/30/20 — 50% de tus ingresos para lo necesario
        (vivienda, comida, transporte), 30% para gustos y 20% para ahorrar. Ponle presupuesto a tus gastos más grandes.
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="category-columns">
          <section className="card">
            <div className="card-header">
              <h2>Gastos</h2>
              <span className="cell-muted">{expenseCategories.length} categorías</span>
            </div>
            {expenseCategories.length === 0 && <p className="empty-state">Aún no tienes categorías de gasto.</p>}
            <ul className="category-list">
              {expenseCategories.map((c) => {
                const spent = spentById.get(c.id) ?? 0;
                const pct = c.monthly_budget ? (spent / c.monthly_budget) * 100 : 0;
                const status = budgetStatusFor(pct);
                return (
                  <li key={c.id} className="category-row">
                    <div className="category-row-main">
                      <span className="category-name">{c.name}</span>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button icon-button-sm"
                          aria-label={`Editar presupuesto de ${c.name}`}
                          title="Editar presupuesto"
                          onClick={() => startEditBudget(c)}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button-sm icon-button-danger"
                          aria-label={`Eliminar ${c.name}`}
                          title="Eliminar"
                          onClick={() => handleDelete(c)}
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    </div>

                    {editingId === c.id ? (
                      <div className="budget-edit-row">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editingBudget}
                          onChange={(e) => setEditingBudget(e.target.value)}
                          placeholder="Sin presupuesto"
                          aria-label={`Presupuesto mensual de ${c.name}`}
                          autoFocus
                        />
                        <button type="button" onClick={() => saveEditBudget(c.id)}>
                          Guardar
                        </button>
                        <button type="button" className="button-secondary" onClick={() => setEditingId(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : c.monthly_budget != null ? (
                      <>
                        <div className="budget-track">
                          <div
                            className={`budget-fill budget-fill-${status}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="budget-text">
                          {formatCLP(spent)} de {formatCLP(c.monthly_budget)} este mes
                        </span>
                      </>
                    ) : (
                      <span className="budget-text">Sin presupuesto mensual</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {renderSuggestions(expenseSuggestions, "expense")}
          </section>

          <section className="card category-income-card">
            <div className="card-header">
              <h2>Ingresos</h2>
              <span className="cell-muted">
                {incomeCategories.length} de {MAX_INCOME_CATEGORIES}
              </span>
            </div>
            <p className="field-hint">
              La mayoría tiene pocas fuentes de ingreso (sueldo, un negocio…), por eso el máximo es{" "}
              {MAX_INCOME_CATEGORIES}.
            </p>
            {incomeCategories.length === 0 && <p className="empty-state">Aún no tienes categorías de ingreso.</p>}
            <ul className="category-list">
              {incomeCategories.map((c) => (
                <li key={c.id} className="category-row">
                  <div className="category-row-main">
                    <span className="category-name">{c.name}</span>
                    <button
                      type="button"
                      className="icon-button icon-button-sm icon-button-danger"
                      aria-label={`Eliminar ${c.name}`}
                      title="Eliminar"
                      onClick={() => handleDelete(c)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {renderSuggestions(incomeSuggestions, "income")}
          </section>
        </div>
      )}

      {modalOpen && (
        <CategoryFormModal
          incomeLimitReached={incomeLimitReached}
          maxIncome={MAX_INCOME_CATEGORIES}
          onClose={() => setModalOpen(false)}
          onCreated={loadCategories}
        />
      )}
    </div>
  );
}
