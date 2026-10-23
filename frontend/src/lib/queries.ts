import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const keys = {
  summary: (month: string) => ["summary", month] as const,
  incomes: (month?: string) => ["incomes", month ?? "all"] as const,
  commitments: () => ["commitments"] as const,
  occurrences: (month?: string) => ["occurrences", month ?? "all"] as const,
  transactions: (filters?: Record<string, string | number | undefined>) => ["transactions", filters ?? {}] as const,
  savingsGoals: () => ["savings-goals"] as const,
  allocations: (month?: string) => ["allocations", month ?? "all"] as const,
  reports: (month: string) => ["reports", month] as const,
  history: () => ["history"] as const,
  categories: () => ["categories"] as const,
};

/** Invalidate everything money-related so Dashboard/Reports recalculate immediately. */
export function useInvalidateMoney() {
  const qc = useQueryClient();
  return (month?: string) => {
    const keys: unknown[][] = [["summary"], ["reports"], ["history"], ["commitments"], ["occurrences"], ["savings-goals"], ["allocations"]];
    for (const k of keys) qc.invalidateQueries({ queryKey: k });
    if (month) {
      qc.invalidateQueries({ queryKey: ["summary", month] });
      qc.invalidateQueries({ queryKey: ["reports", month] });
    }
    qc.invalidateQueries({ queryKey: ["summary"] });
    qc.invalidateQueries({ queryKey: ["reports"] });
    qc.invalidateQueries({ queryKey: ["occurrences"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["incomes"] });
    qc.invalidateQueries({ queryKey: ["allocations"] });
  };
}

export function useSummary(month: string) {
  return useQuery({ queryKey: keys.summary(month), queryFn: () => api.summary(month) });
}

export function useIncomes(month?: string) {
  return useQuery({ queryKey: keys.incomes(month), queryFn: () => api.incomes(month) });
}

export function useCommitments(includeArchived = true) {
  return useQuery({ queryKey: keys.commitments(), queryFn: () => api.commitments({ include_archived: includeArchived }) });
}

export function useOccurrences(month?: string) {
  return useQuery({ queryKey: keys.occurrences(month), queryFn: () => api.occurrences(month) });
}

export function useTransactions(filters?: { type?: string; month?: string; category_id?: number }) {
  const f = filters ?? {};
  const norm = { type: f.type, month: f.month, category_id: f.category_id };
  return useQuery({
    queryKey: keys.transactions({ type: norm.type, month: norm.month, category_id: norm.category_id }),
    queryFn: () => api.transactions(norm),
  });
}

export function useSavingsGoals() {
  return useQuery({ queryKey: keys.savingsGoals(), queryFn: () => api.savingsGoals() });
}

export function useSavingsAllocations(month?: string) {
  return useQuery({ queryKey: keys.allocations(month), queryFn: () => api.savingsAllocations({ month }) });
}

export function useReportMonthly(month: string) {
  return useQuery({ queryKey: keys.reports(month), queryFn: () => api.reportMonthly(month) });
}

export function useReportHistory() {
  return useQuery({ queryKey: keys.history(), queryFn: () => api.reportHistory(12) });
}

export function useCategories() {
  return useQuery({ queryKey: keys.categories(), queryFn: () => api.categories() });
}

export function useAppSettings() {
  return useQuery({ queryKey: ["app-settings"], queryFn: () => api.getSettings() });
}

export function useApiMutation<TIn, TOut>(
  fn: (input: TIn) => Promise<TOut>,
  invalidate: (qc: QueryClient, data: TOut) => void = () => undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => invalidate(qc, data),
  });
}
