export type Frequency = "weekly" | "monthly" | "yearly" | "one_time";
export type TxnType = "payment" | "expense";
export type OccurrenceStatus = "paid" | "pending" | "overdue";

export interface Category {
  id: number;
  name: string;
  icon: string;
  is_default: boolean;
}

export interface Income {
  id: number;
  source_name: string;
  amount_sen: number;
  income_date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Commitment {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  amount_sen: number;
  frequency: Frequency;
  start_date: string;
  due_date: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Occurrence {
  commitment_id: number;
  commitment_name: string;
  category_name: string;
  category_icon: string;
  amount_sen: number;
  occurrence_date: string;
  status: OccurrenceStatus;
  payment_id: number | null;
}

export interface Transaction {
  id: number;
  type: TxnType;
  amount_sen: number;
  txn_date: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  commitment_id: number | null;
  commitment_name: string | null;
  occurrence_date: string | null;
  created_at: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  target_sen: number | null;
  target_date: string | null;
  notes: string | null;
  archived: boolean;
  allocated_total_sen: number;
}

export interface SavingsAllocation {
  id: number;
  goal_id: number;
  goal_name: string;
  amount_sen: number;
  allocation_date: string;
  note: string | null;
}

export interface CategoryBreakdownItem {
  category_name: string;
  icon: string;
  amount_sen: number;
}

export interface SavingsByGoalItem {
  goal_id: number;
  goal_name: string;
  allocated_this_month_sen: number;
  allocated_total_sen: number;
  target_sen: number | null;
  target_date: string | null;
}

export interface UpcomingItem {
  commitment_id: number;
  commitment_name: string;
  category_name: string;
  category_icon: string;
  amount_sen: number;
  occurrence_date: string;
  status: OccurrenceStatus;
}

export interface Summary {
  month: string;
  total_income_sen: number;
  total_commitments_sen: number;
  total_savings_sen: number;
  available_sen: number;
  income_count: number;
  category_breakdown: CategoryBreakdownItem[];
  savings_by_goal: SavingsByGoalItem[];
  upcoming: UpcomingItem[];
  recent_transactions: Transaction[];
}

export interface ReportMonthly extends Summary {
  prev_month: string;
  prev_total_income_sen: number;
  prev_total_commitments_sen: number;
  prev_total_savings_sen: number;
  prev_available_sen: number;
  paid_sen: number;
  planned_sen: number;
  payment_count: number;
}

export interface HistoryPoint {
  month: string;
  income_sen: number;
  commitments_sen: number;
  savings_sen: number;
  available_sen: number;
}

export interface AuthStatus {
  auth_required: boolean;
}

export interface AppSettings {
  display_name: string;
}
