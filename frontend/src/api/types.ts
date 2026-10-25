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
}

// El saldo no se edita: solo cambia con los movimientos.
export interface AccountUpdate {
  name?: string;
  type?: AccountType;
  institution_id?: string | null;
  product_id?: string | null;
  credit_limit?: number | null;
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
