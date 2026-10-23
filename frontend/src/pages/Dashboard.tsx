import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet, FileText, PiggyBank, BarChart3, Plus, Pencil, Trash2,
  ArrowUpRight, ArrowDownRight, CalendarClock, BarChart2, ListTodo, BadgeDollarSign,
  CalendarDays,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
} from "recharts";
import toast from "react-hot-toast";
import {
  formatMYR, formatNum, formatRMShort, formatDate, formatMonthLong,
} from "../lib/format";
import { useMonthParam } from "../lib/useMonthParam";
import {
  useSummary, useIncomes, useOccurrences, useSavingsAllocations,
  useReportMonthly, useInvalidateMoney, useCommitments,
} from "../lib/queries";
import { api, ApiError } from "../lib/api";
import { categoryIcon } from "../lib/icons";
import { ErrorAlert, Skeleton } from "../components/states";
import {
  Card, CardHeader, IconCircle, StatusBadge, PinkButton, TH, TD,
} from "../components/ui/primitives";
import { IncomeDialog } from "../components/dialogs/IncomeDialog";
import { CommitmentDialog } from "../components/dialogs/CommitmentDialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "../components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import type { Commitment, Income, Occurrence } from "../lib/types";

const DONUT = {
  pink: "var(--ct-donut-pink)",
  green: "var(--ct-donut-green)",
  blue: "var(--ct-donut-blue)",
  amber: "var(--ct-donut-amber)",
};

function pctOf(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/** Status badge matching the reference: Paid green / Pending amber / Overdue red / Allocated blue. */
// ---------- summary cards ----------

function SummaryCards({ month }: { month: string }) {
  const summary = useSummary(month);
  const report = useReportMonthly(month);
  const s = summary.data;
  const r = report.data;

  if (summary.isLoading || report.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)}
      </div>
    );
  }
  if (summary.isError || !s) {
    return <ErrorAlert error={summary.error} onRetry={() => summary.refetch()} />;
  }

  const income = s.total_income_sen;
  const delta = r ? income - r.prev_total_income_sen : 0;
  const deltaPct = r && r.prev_total_income_sen > 0 ? Math.round((delta / r.prev_total_income_sen) * 100) : null;
  const commitPct = pctOf(s.total_commitments_sen, income);
  const savingsPct = pctOf(s.total_savings_sen, income);
  const availPct = pctOf(Math.max(s.available_sen, 0), income);

  const cardBase = "rounded-2xl p-4 shadow-card";
  const iconBox = "flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-soft";

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {/* Total Income */}
      <div className={`${cardBase} bg-blush-150 dark:bg-base-100`}>
        <div className="flex items-center gap-3.5">
          <div className={iconBox}><Wallet className="h-6 w-6 text-blush-600" /></div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-mauve">Total Income</div>
            <div className="truncate text-[22px] font-bold text-blush-700 tabular-nums">
              {formatMYR(income)}
            </div>
          </div>
        </div>
        <div className="mt-2 pl-[64px] text-xs">
          {deltaPct === null ? (
            <span className="text-mauve">no data last month</span>
          ) : delta >= 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-sage-600">
              <ArrowUpRight className="h-3.5 w-3.5" /> {deltaPct}% from last month
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-error">
              <ArrowDownRight className="h-3.5 w-3.5" /> {Math.abs(deltaPct)}% from last month
            </span>
          )}
        </div>
      </div>

      {/* Total Commitments */}
      <div className={`${cardBase} bg-blush-100 dark:bg-base-100`}>
        <div className="flex items-center gap-3.5">
          <div className={iconBox}><FileText className="h-6 w-6 text-blush-600" /></div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-mauve">Total Commitments</div>
            <div className="truncate text-[22px] font-bold text-blush-700 tabular-nums">
              {formatMYR(s.total_commitments_sen)}
            </div>
          </div>
        </div>
        <div className="mt-2 pl-[64px]">
          <div className="text-xs text-mauve">{commitPct.toFixed(1)}% of income</div>
          <div className="mt-1 h-2 w-[110px] overflow-hidden rounded-full bg-white/70">
            <div
              className="h-full rounded-full bg-blush-400"
              style={{ width: `${Math.min(commitPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Total Savings */}
      <div className={`${cardBase} bg-sage-100 dark:bg-base-100`}>
        <div className="flex items-center gap-3.5">
          <div className={iconBox}><PiggyBank className="h-6 w-6 text-sage-600" /></div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-mauve">Total Savings (Allocated)</div>
            <div className="truncate text-[22px] font-bold text-sage-600 tabular-nums">
              {formatMYR(s.total_savings_sen)}
            </div>
          </div>
        </div>
        <div className="mt-2 pl-[64px] text-xs text-mauve">{savingsPct.toFixed(1)}% of income</div>
      </div>

      {/* Available Balance */}
      <div className={`${cardBase} bg-sky-100 dark:bg-base-100`}>
        <div className="flex items-center gap-3.5">
          <div className={iconBox}><BarChart3 className="h-6 w-6 text-sky-600" /></div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-mauve">Available Balance</div>
            <div
              className={`truncate text-[22px] font-bold tabular-nums ${
                s.available_sen < 0 ? "text-error" : "text-sky-600"
              }`}
            >
              {formatMYR(s.available_sen)}
            </div>
          </div>
        </div>
        <div className="mt-2 pl-[64px] text-xs text-mauve">{availPct.toFixed(1)}% of income</div>
      </div>
    </div>
  );
}

// ---------- income card ----------

function IncomeCard({ month, onAdd, onEdit }: { month: string; onAdd: () => void; onEdit: (income: Income) => void }) {
  const incomes = useIncomes(month);
  const invalidate = useInvalidateMoney();
  const [deleting, setDeleting] = useState<Income | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await api.deleteIncome(deleting.id);
      toast.success("Income deleted");
      invalidate(month);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : "Failed to delete income");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<BadgeDollarSign className="h-6 w-6" />}
        title="Income"
        subtitle={`Manage your income sources for ${formatMonthLong(month)}.`}
        action={
          <PinkButton onClick={onAdd}>
            <Plus className="h-4 w-4" /> Add Income
          </PinkButton>
        }
      />
      {incomes.isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : incomes.isError ? (
        <ErrorAlert error={incomes.error} onRetry={() => incomes.refetch()} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl">
            <table className="w-full">
              <thead>
                <tr className="bg-blush-100/80">
                  <th className={`${TH} w-[38%]`}>Source</th>
                  <th className={`${TH} text-right`}>Amount (RM)</th>
                  <th className={`${TH} hidden sm:table-cell`}>Notes</th>
                  <th className={`${TH} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {incomes.data!.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${TD} text-center text-mauve`}>
                      No income recorded for this month yet.
                    </td>
                  </tr>
                ) : (
                  incomes.data!.map((inc) => (
                    <tr key={inc.id} className="border-b border-blush-100/70 last:border-0">
                      <td className={TD}>
                        <span className="flex items-center gap-3 font-medium text-ink">
                          <IconCircle className="bg-blush-100 text-blush-600">
                            <Wallet className="h-4 w-4" />
                          </IconCircle>
                          {inc.source_name}
                        </span>
                      </td>
                      <td className={`${TD} text-right font-semibold tabular-nums`}>
                        {formatNum(inc.amount_sen)}
                      </td>
                      <td className={`${TD} hidden text-mauve sm:table-cell`}>
                        {inc.description || "—"}
                      </td>
                      <td className={TD}>
                        <span className="flex items-center justify-end gap-1.5">
                          <button
                            aria-label={`Edit ${inc.source_name}`}
                            onClick={() => onEdit(inc)}
                            className="rounded-lg p-2 text-blush-500 transition-colors hover:bg-blush-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            aria-label={`Delete ${inc.source_name}`}
                            onClick={() => setDeleting(inc)}
                            className="rounded-lg p-2 text-blush-500 transition-colors hover:bg-blush-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <button
            onClick={onAdd}
            className="mt-3 flex w-full items-center gap-3 rounded-xl bg-blush-50 px-4 py-3.5 text-sm font-medium text-blush-600 transition-colors hover:bg-blush-100 dark:bg-base-300 dark:hover:bg-base-300/70"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blush-500 text-white">
              <Plus className="h-4 w-4" />
            </span>
            Add new income source
          </button>
        </>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete income?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{deleting?.source_name}" ({formatMYR(deleting?.amount_sen ?? 0)}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deletePending} onClick={(e) => { e.preventDefault(); confirmDelete(); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ---------- commitments card ----------

interface CommitmentRow {
  key: string;
  name: string;
  icon: string;
  amount_sen: number;
  count: number;
  status: "paid" | "pending" | "overdue" | "allocated";
  notes: string;
  commitment?: Commitment;
}

function CommitmentsCard({
  month, onAdd, onEdit,
}: {
  month: string;
  onAdd: () => void;
  onEdit: (c: Commitment) => void;
}) {
  const occurrences = useOccurrences(month);
  const allocations = useSavingsAllocations(month);
  const commitments = useCommitments(false);
  const invalidate = useInvalidateMoney();
  const [deleting, setDeleting] = useState<Commitment | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const notesById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const c of commitments.data ?? []) map[c.id] = c.notes ?? "";
    return map;
  }, [commitments.data]);

  const rows = useMemo<CommitmentRow[]>(() => {
    const occ = occurrences.data ?? [];
    const byCommitment = new Map<number, { occ: Occurrence[]; name: string; icon: string }>();
    for (const o of occ) {
      const entry = byCommitment.get(o.commitment_id) ?? { occ: [], name: o.commitment_name, icon: o.category_icon };
      entry.occ.push(o);
      byCommitment.set(o.commitment_id, entry);
    }
    const commitmentRows: CommitmentRow[] = [...byCommitment.entries()].map(([id, { occ, name, icon }]) => {
      const paid = occ.filter((o) => o.status === "paid").length;
      const overdue = occ.filter((o) => o.status === "overdue").length;
      const status = paid === occ.length ? "paid" : overdue > 0 ? "overdue" : "pending";
      return {
        key: `c${id}`,
        name,
        icon,
        amount_sen: occ.reduce((sum, o) => sum + o.amount_sen, 0),
        count: occ.length,
        status,
        notes: notesById[id] ?? "",
      };
    });

    const byGoal = new Map<number, { total: number; name: string }>();
    for (const a of allocations.data ?? []) {
      const g = byGoal.get(a.goal_id) ?? { total: 0, name: a.goal_name };
      g.total += a.amount_sen;
      byGoal.set(a.goal_id, g);
    }
    const savingsRows: CommitmentRow[] = [...byGoal.entries()].map(([id, g]) => ({
      key: `g${id}`,
      name: g.name,
      icon: "PiggyBank",
      amount_sen: g.total,
      count: 0,
      status: "allocated",
      notes: "Savings goal",
    }));

    return [...commitmentRows, ...savingsRows].sort((a, b) =>
      a.status === "allocated" ? 1 : b.status === "allocated" ? -1 : b.amount_sen - a.amount_sen,
    );
  }, [occurrences.data, allocations.data]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await api.deleteCommitment(deleting.id);
      toast.success("Commitment deleted");
      invalidate(month);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : "Failed to delete commitment");
    } finally {
      setDeletePending(false);
    }
  }

  const loading = occurrences.isLoading || allocations.isLoading;
  const error = occurrences.isError ? occurrences.error : allocations.isError ? allocations.error : null;

  return (
    <Card>
      <CardHeader
        icon={<ListTodo className="h-6 w-6" />}
        title="Commitments"
        subtitle="Your monthly commitments and allocations."
        action={
          <PinkButton onClick={onAdd}>
            <Plus className="h-4 w-4" /> Add Commitment
          </PinkButton>
        }
      />
      {loading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : error ? (
        <ErrorAlert error={error} onRetry={() => { occurrences.refetch(); allocations.refetch(); }} />
      ) : (
        <div className="overflow-hidden rounded-xl">
          <table className="w-full">
            <thead>
              <tr className="bg-blush-100/80">
                <th className={`${TH} w-[30%]`}>Category</th>
                <th className={`${TH} text-right`}>Amount (RM)</th>
                <th className={TH}>Status</th>
                <th className={`${TH} hidden md:table-cell`}>Notes</th>
                <th className={`${TH} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${TD} text-center text-mauve`}>
                    No commitments for this month yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const Icon = row.icon === "PiggyBank" ? PiggyBank : categoryIcon(row.icon);
                  const isSavings = row.status === "allocated";
                  return (
                    <tr key={row.key} className="border-b border-blush-100/70 last:border-0">
                      <td className={TD}>
                        <span className="flex items-center gap-3 font-medium text-ink">
                          <IconCircle className={isSavings ? "bg-sage-100 text-sage-600" : "bg-blush-100 text-blush-600"}>
                            <Icon className="h-4 w-4" />
                          </IconCircle>
                          <span className="truncate">{row.name}</span>
                        </span>
                      </td>
                      <td className={`${TD} text-right font-semibold tabular-nums`}>
                        {formatNum(row.amount_sen)}
                        {row.count > 1 && <span className="ml-1 text-xs font-normal text-mauve">×{row.count}</span>}
                      </td>
                      <td className={TD}><StatusBadge status={row.status} /></td>
                      <td className={`${TD} hidden text-mauve md:table-cell`}>{row.notes || "—"}</td>
                      <td className={TD}>
                        <span className="flex items-center justify-end gap-1.5">
                          {row.commitment && (
                            <>
                              <button
                                aria-label={`Edit ${row.name}`}
                                onClick={() => onEdit(row.commitment!)}
                                className="rounded-lg p-2 text-blush-500 transition-colors hover:bg-blush-100"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                aria-label={`Delete ${row.name}`}
                                onClick={() => setDeleting(row.commitment!)}
                                className="rounded-lg p-2 text-blush-500 transition-colors hover:bg-blush-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete commitment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{deleting?.name}". Commitments with payment history cannot be
              deleted — archive them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deletePending} onClick={(e) => { e.preventDefault(); confirmDelete(); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ---------- donut card ----------

function IncomeVsCommitmentsCard({ month }: { month: string }) {
  const summary = useSummary(month);
  const s = summary.data;

  if (summary.isLoading) return <Card><Skeleton className="h-[300px] rounded-xl" /></Card>;
  if (summary.isError || !s) return <Card><ErrorAlert error={summary.error} onRetry={() => summary.refetch()} /></Card>;

  const data = [
    { name: "Commitments", value: Math.max(s.total_commitments_sen, 0) / 100, fill: DONUT.pink },
    { name: "Savings", value: Math.max(s.total_savings_sen, 0) / 100, fill: DONUT.green },
    { name: "Available", value: Math.max(s.available_sen, 0) / 100, fill: DONUT.blue },
  ];
  const total = s.total_income_sen;
  const legend = [
    { label: "Commitments", sen: s.total_commitments_sen, color: DONUT.pink },
    { label: "Savings", sen: s.total_savings_sen, color: DONUT.green },
    { label: "Available Balance", sen: Math.max(s.available_sen, 0), color: DONUT.blue },
  ];

  return (
    <Card>
      <CardHeader icon={<BarChart2 className="h-6 w-6" />} title="Income vs Commitments" />
      {total === 0 ? (
        <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-mauve">
          <PieNotation />
          <p className="text-sm">No income for {formatMonthLong(month)} yet.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-[210px] w-[210px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="72%"
                  outerRadius="98%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
                </Pie>
                <ReTooltip formatter={(v: number) => `RM ${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-ink tabular-nums">{formatRMShort(total)}</span>
              <span className="text-xs text-mauve">Total Income</span>
            </div>
          </div>
          <ul className="flex w-full flex-col gap-3 sm:w-auto">
            {legend.map((l) => (
              <li key={l.label} className="flex items-start gap-2.5">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: l.color }} />
                <span>
                  <span className="block text-sm font-semibold text-ink">{l.label}</span>
                  <span className="block text-[13px] text-mauve tabular-nums">
                    {formatNum(l.sen)} ({pctOf(l.sen, total).toFixed(1)}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function PieNotation() {
  return (
    <div className="h-24 w-24 rounded-full border-[14px] border-blush-100" />
  );
}

// ---------- monthly breakdown ----------

function BreakdownCard({ month }: { month: string }) {
  const summary = useSummary(month);
  const [sort, setSort] = useState("category");
  const s = summary.data;

  const rows = useMemo(() => {
    if (!s) return [];
    const commitmentRows = s.category_breakdown.map((c) => ({
      key: c.category_name,
      name: c.category_name,
      icon: categoryIcon(c.icon),
      iconClass: "text-blush-600",
      amount_sen: c.amount_sen,
    }));
    const savingsRows = s.savings_by_goal
      .filter((g) => g.allocated_this_month_sen > 0)
      .map((g) => ({
        key: `savings-${g.goal_id}`,
        name: g.goal_name,
        icon: PiggyBank,
        iconClass: "text-sage-600",
        amount_sen: g.allocated_this_month_sen,
      }));
    const all = [...commitmentRows, ...savingsRows];
    return sort === "amount" ? [...all].sort((a, b) => b.amount_sen - a.amount_sen) : all;
  }, [s, sort]);

  const maxAmount = rows.length ? Math.max(...rows.map((r) => r.amount_sen)) : 0;

  return (
    <Card>
      <CardHeader
        icon={<BarChart2 className="h-6 w-6" />}
        title="Monthly Breakdown"
        action={
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 w-[140px] rounded-lg text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">By Category</SelectItem>
              <SelectItem value="amount">By Amount</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      {summary.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : summary.isError || !s ? (
        <ErrorAlert error={summary.error} onRetry={() => summary.refetch()} />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-mauve">No allocations for {formatMonthLong(month)} yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[minmax(130px,175px)_1fr_auto] items-center gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
                <row.icon className={`h-4 w-4 shrink-0 ${row.iconClass}`} />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-[var(--ct-bar-track)]">
                <span
                  className="block h-full rounded-full bg-[var(--ct-bar-fill)]"
                  style={{ width: `${maxAmount > 0 ? (row.amount_sen / maxAmount) * 100 : 0}%` }}
                />
              </span>
              <span className="text-sm font-semibold text-ink tabular-nums">{formatNum(row.amount_sen)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- upcoming payments ----------

function UpcomingCard({ month }: { month: string }) {
  const summary = useSummary(month);
  const s = summary.data;
  const items = (s?.upcoming ?? []).slice(0, 6);

  return (
    <Card>
      <CardHeader
        icon={<CalendarClock className="h-6 w-6" />}
        title="Upcoming Payments"
        action={
          <Link to="/calendar" className="flex items-center gap-1 text-[13px] font-medium text-blush-600 hover:text-blush-700">
            View All
          </Link>
        }
      />
      {summary.isLoading ? (
        <Skeleton className="h-36 rounded-xl" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-mauve">
          <CalendarDays className="h-8 w-8 text-blush-300" />
          <p className="text-sm">Nothing due in the next 14 days.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-blush-100/70">
          {items.map((u) => {
            const Icon = categoryIcon(u.category_icon);
            return (
              <li key={`${u.commitment_id}-${u.occurrence_date}`} className="grid grid-cols-[1fr_auto] items-center gap-2 py-2.5 sm:grid-cols-[1.4fr_1fr_auto_auto]">
                <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-ink">
                  <IconCircle className="bg-blush-100 text-blush-600">
                    <Icon className="h-4 w-4" />
                  </IconCircle>
                  <span className="truncate">{u.commitment_name}</span>
                </span>
                <span className="hidden text-[13px] text-mauve sm:block">{formatDate(u.occurrence_date)}</span>
                <span className="text-sm font-semibold text-ink tabular-nums">{formatNum(u.amount_sen)}</span>
                <StatusBadge status={u.status === "paid" ? "paid" : u.status === "overdue" ? "overdue" : "pending"} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------- page ----------

export function Dashboard() {
  const [month] = useMonthParam();
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<Commitment | null>(null);

  function openAddIncome() {
    setEditingIncome(null);
    setIncomeOpen(true);
  }
  function openEditIncome(income: Income) {
    setEditingIncome(income);
    setIncomeOpen(true);
  }
  function openAddCommitment() {
    setEditingCommitment(null);
    setCommitmentOpen(true);
  }
  function openEditCommitment(c: Commitment) {
    setEditingCommitment(c);
    setCommitmentOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <SummaryCards month={month} />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.75fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <IncomeCard month={month} onAdd={openAddIncome} onEdit={openEditIncome} />
          <CommitmentsCard month={month} onAdd={openAddCommitment} onEdit={openEditCommitment} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <IncomeVsCommitmentsCard month={month} />
          <BreakdownCard month={month} />
          <UpcomingCard month={month} />
        </div>
      </div>

      <IncomeDialog
        open={incomeOpen}
        onOpenChange={setIncomeOpen}
        editing={editingIncome}
        defaultDate={`${month}-01`}
      />
      <CommitmentDialog
        open={commitmentOpen}
        onOpenChange={setCommitmentOpen}
        editing={editingCommitment}
      />
    </div>
  );
}
