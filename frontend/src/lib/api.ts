import type {
  AppSettings,
  AuthStatus,
  Category,
  Commitment,
  Frequency,
  HistoryPoint,
  Income,
  Occurrence,
  ReportMonthly,
  SavingsAllocation,
  SavingsGoal,
  Summary,
  Transaction,
} from "./types";

const TOKEN_KEY = "ct_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (res.status === 401) {
    setToken(null);
    window.location.reload();
    throw new ApiError(401, "Not authenticated");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) {
        // pydantic 422 loc path -> readable message
        detail = body.detail
          .map((e) => {
            const err = e as { loc?: (string | number)[]; msg?: string };
            const loc = (err.loc ?? []).filter((p) => p !== "body").join(".");
            return loc ? `${loc}: ${err.msg ?? "invalid"}` : (err.msg ?? "invalid");
          })
          .join("; ");
      }
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  authStatus: () => request<AuthStatus>("/auth/status"),
  login: (password: string) =>
    request<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),

  categories: () => request<Category[]>("/categories"),
  createCategory: (name: string, icon?: string) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify({ name, icon }) }),
  updateCategory: (id: number, patch: { name?: string; icon?: string }) =>
    request<Category>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: "DELETE" }),

  incomes: (month?: string) => request<Income[]>(`/incomes${qs({ month })}`),
  createIncome: (body: { source_name: string; amount_sen: number; income_date: string; description?: string | null }) =>
    request<Income>("/incomes", { method: "POST", body: JSON.stringify(body) }),
  updateIncome: (id: number, patch: Partial<{ source_name: string; amount_sen: number; income_date: string; description: string | null }>) =>
    request<Income>(`/incomes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteIncome: (id: number) => request<void>(`/incomes/${id}`, { method: "DELETE" }),

  commitments: (filters?: { category_id?: number; include_archived?: boolean }) =>
    request<Commitment[]>(`/commitments${qs({ category_id: filters?.category_id, include_archived: filters?.include_archived ? "true" : undefined })}`),
  createCommitment: (body: {
    name: string; category_id: number; amount_sen: number; frequency: Frequency;
    start_date: string; due_date?: string | null; notes?: string | null;
  }) => request<Commitment>("/commitments", { method: "POST", body: JSON.stringify(body) }),
  updateCommitment: (id: number, patch: Partial<{
    name: string; category_id: number; amount_sen: number; frequency: Frequency;
    start_date: string; due_date: string | null; notes: string | null; archived: boolean;
  }>) => request<Commitment>(`/commitments/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCommitment: (id: number) => request<void>(`/commitments/${id}`, { method: "DELETE" }),
  occurrences: (month?: string) => request<Occurrence[]>(`/commitments/occurrences${qs({ month })}`),
  pay: (commitmentId: number, occurrenceDate: string) =>
    request<Transaction>(`/commitments/${commitmentId}/pay`, { method: "POST", body: JSON.stringify({ occurrence_date: occurrenceDate }) }),

  transactions: (filters?: { type?: string; month?: string; category_id?: number }) =>
    request<Transaction[]>(`/transactions${qs({ type: filters?.type, month: filters?.month, category_id: filters?.category_id })}`),
  createExpense: (body: { amount_sen: number; txn_date: string; description?: string | null; category_id?: number | null }) =>
    request<Transaction>("/transactions", { method: "POST", body: JSON.stringify({ type: "expense", ...body }) }),
  updateTransaction: (id: number, patch: Partial<{ amount_sen: number; txn_date: string; description: string | null; category_id: number | null }>) =>
    request<Transaction>(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTransaction: (id: number) => request<void>(`/transactions/${id}`, { method: "DELETE" }),

  savingsGoals: () => request<SavingsGoal[]>("/savings/goals"),
  createSavingsGoal: (body: { name: string; target_sen?: number | null; target_date?: string | null; notes?: string | null }) =>
    request<SavingsGoal>("/savings/goals", { method: "POST", body: JSON.stringify(body) }),
  updateSavingsGoal: (id: number, patch: Partial<{ name: string; target_sen: number | null; target_date: string | null; notes: string | null; archived: boolean }>) =>
    request<SavingsGoal>(`/savings/goals/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteSavingsGoal: (id: number) => request<void>(`/savings/goals/${id}`, { method: "DELETE" }),
  savingsAllocations: (filters?: { month?: string; goal_id?: number }) =>
    request<SavingsAllocation[]>(`/savings/allocations${qs({ month: filters?.month, goal_id: filters?.goal_id })}`),
  createSavingsAllocation: (body: { goal_id: number; amount_sen: number; allocation_date: string; note?: string | null }) =>
    request<SavingsAllocation>("/savings/allocations", { method: "POST", body: JSON.stringify(body) }),
  updateSavingsAllocation: (id: number, patch: Partial<{ amount_sen: number; allocation_date: string; note: string | null; goal_id: number }>) =>
    request<SavingsAllocation>(`/savings/allocations/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteSavingsAllocation: (id: number) => request<void>(`/savings/allocations/${id}`, { method: "DELETE" }),

  summary: (month: string) => request<Summary>(`/summary${qs({ month })}`),
  reportMonthly: (month: string) => request<ReportMonthly>(`/reports/monthly${qs({ month })}`),
  reportHistory: (months = 12) => request<HistoryPoint[]>(`/reports/history${qs({ months })}`),

  export: () => request<unknown>("/export"),
  getSettings: () => request<AppSettings>("/settings"),
  updateSettings: (patch: { display_name: string }) =>
    request<AppSettings>("/settings", { method: "PATCH", body: JSON.stringify(patch) }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<void>("/settings/password", { method: "PATCH", body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }) }),
};
