export type AccountType = "cash" | "bank" | "credit_card" | "savings";
export type TransactionType = "income" | "expense";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: number;
  balance_base: number;
  currency: string;
  institution_id: string | null;
  product_id: string | null;
  institution_name: string | null;
  product_name: string | null;
  credit_limit: number | null;
  interest_rate: number | null;
  minimum_payment: number | null;
  created_at: string;
}

export interface AccountCreate {
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  institution_id?: string | null;
  product_id?: string | null;
  credit_limit?: number | null;
  interest_rate?: number | null;
  minimum_payment?: number | null;
}

// El saldo no se edita: solo cambia con los movimientos.
export interface AccountUpdate {
  name?: string;
  type?: AccountType;
  institution_id?: string | null;
  product_id?: string | null;
  credit_limit?: number | null;
  interest_rate?: number | null;
  minimum_payment?: number | null;
}

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  monthly_budget: number | null;
  created_at: string;
}

export interface CategoryCreate {
  name: string;
  type: TransactionType;
  monthly_budget?: number | null;
}

export interface CategoryUpdate {
  name?: string;
  type?: TransactionType;
  monthly_budget?: number | null;
}

export interface Transaction {
  id: number;
  account_id: number;
  category: Category;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
}

export interface TransactionCreate {
  account_id: number;
  category_id: number;
  amount: number;
  description?: string | null;
  date: string;
}

export interface TransactionUpdate {
  category_id?: number;
  amount?: number;
  description?: string | null;
  date?: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  target_date: string;
  account: Account | null;
  current_amount: number;
  start_amount: number;
  created_at: string;
}

export interface SavingsGoalCreate {
  account_id?: number | null;
  name: string;
  target_amount: number;
  target_date: string;
}

export interface SavingsGoalUpdate {
  name?: string;
  target_amount?: number;
  target_date?: string;
}

export interface SavingsContribution {
  id: number;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface SavingsContributionCreate {
  amount: number;
  date: string;
  note?: string | null;
}

export interface Transfer {
  id: number;
  from_account_id: number;
  to_account_id: number;
  amount: number;
  to_amount: number;
  description: string | null;
  date: string;
  created_at: string;
}

export interface TransferCreate {
  from_account_id: number;
  to_account_id: number;
  amount: number;
  to_amount?: number | null;
  description?: string | null;
  date: string;
}

export interface TransferUpdate {
  amount?: number;
  to_amount?: number | null;
  description?: string | null;
  date?: string;
}

export type DebtKind = "consumer_loan" | "cash_advance" | "store_credit" | "personal" | "other";
export type DebtStrategy = "avalanche" | "snowball";

export interface Debt {
  id: number;
  name: string;
  kind: DebtKind;
  balance: number;
  interest_rate: number; // % mensual
  minimum_payment: number;
  created_at: string;
}

export interface DebtCreate {
  name: string;
  kind: DebtKind;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
}

export type DebtUpdate = Partial<DebtCreate>;

// Una deuda dentro del plan: tarjeta de crédito (source "card", id de la cuenta) o deuda registrada.
export interface PlanDebt {
  key: string;
  source: "card" | "debt";
  id: number;
  name: string;
  kind: DebtKind | "credit_card";
  balance: number;
  interest_rate: number | null;
  minimum_payment: number | null;
  monthly_interest: number;
  included: boolean;
}

export interface PlanScenario {
  status: "ok" | "insufficient_budget" | "never";
  months: number | null;
  total_interest: number;
  total_paid: number;
  payoffs: { key: string; name: string; month: number }[];
  timeline: number[]; // deuda total al terminar cada mes; el primer valor es la deuda actual
}

export interface DebtPlan {
  monthly_budget: number;
  budget_is_saved: boolean;
  strategy: DebtStrategy;
  total_balance: number;
  total_minimum: number;
  monthly_interest: number;
  debts: PlanDebt[];
  avalanche: PlanScenario;
  snowball: PlanScenario;
  minimum_only: PlanScenario;
}
