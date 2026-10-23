import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line, Legend, } from "recharts";
import { ArrowDownRight, ArrowUpRight, ChartPie, ListChecks, Minus, TrendingUp } from "lucide-react";
import { formatMYR, formatMonth } from "../lib/format";
import { useMonthParam } from "../lib/useMonthParam";
import { useReportHistory, useReportMonthly } from "../lib/queries";
import { EmptyState, ErrorAlert, Skeleton, StatCard } from "../components/states";
import { MonthPicker } from "../components/ui/month-picker";
import { Card, CardHeader, TH, TD } from "../components/ui/primitives";
import { Banknote, PiggyBank, Wallet } from "lucide-react";

function Delta({ now, prev, invert = false }: { now: number; prev: number; invert?: boolean }) {
  if (prev === 0 && now === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-mauve"><Minus className="h-3 w-3" /> no change</span>;
  }
  const diff = now - prev;
  const pct = prev === 0 ? null : Math.round((diff / prev) * 100);
  const up = diff > 0;
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${diff === 0 ? "text-mauve" : good ? "text-sage-600" : "text-blush-700"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {pct === null ? formatMYR(Math.abs(diff)) : `${Math.abs(pct)}% vs prev`}
    </span>
  );
}

export function Reports() {
  const [month, setMonth] = useMonthParam();
  const report = useReportMonthly(month);
  const history = useReportHistory();

  const r = report.data;

  const barData = r
    ? [
        { name: "Income", value: r.total_income_sen / 100 },
        { name: "Commitments", value: r.total_commitments_sen / 100 },
        { name: "Savings", value: r.total_savings_sen / 100 },
      ]
    : [];

  const lineData = (history.data ?? []).map((h) => ({
    month: formatMonth(h.month),
    income: h.income_sen / 100,
    commitments: h.commitments_sen / 100,
    savings: h.savings_sen / 100,
  }));

  const commitTotal = r?.total_commitments_sen ?? 0;
  const hasMoney = r !== undefined && (r.total_income_sen !== 0 || r.total_commitments_sen !== 0 || r.total_savings_sen !== 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      {report.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : report.isError ? (
        <ErrorAlert message="Could not load report." onRetry={() => void report.refetch()} />
      ) : r && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <StatCard icon={Banknote} label="Income" value={formatMYR(r.total_income_sen)} />
              <Delta now={r.total_income_sen} prev={r.prev_total_income_sen} />
            </div>
            <div className="flex flex-col gap-1">
              <StatCard icon={ListChecks} label="Commitments" value={formatMYR(r.total_commitments_sen)} />
              <Delta now={r.total_commitments_sen} prev={r.prev_total_commitments_sen} invert />
            </div>
            <div className="flex flex-col gap-1">
              <StatCard icon={PiggyBank} label="Savings" value={formatMYR(r.total_savings_sen)} />
              <Delta now={r.total_savings_sen} prev={r.prev_total_savings_sen} />
            </div>
            <div className="flex flex-col gap-1">
              <StatCard icon={Wallet} label="Available" value={formatMYR(r.available_sen)} negative={r.available_sen < 0} />
              <Delta now={r.available_sen} prev={r.prev_available_sen} />
            </div>
          </div>

          {!hasMoney ? (
            <Card>
              <EmptyState icon={ChartPie} hint="No data for this month yet." />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                  <CardHeader icon={<ChartPie className="h-6 w-6" />} title="Income vs Allocations" />
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--ct-bar-track)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#3B2B33" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#3B2B33" }} axisLine={false} tickLine={false} />
                        <ReTooltip formatter={(v) => formatMYR(Number(v) * 100)} />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {barData.map((_, i) => (
                            <Cell key={i} fill={["var(--ct-donut-pink)", "var(--ct-donut-blue)", "var(--ct-donut-green)"][i]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Payment stats + category table */}
                <Card>
                  <CardHeader icon={<Wallet className="h-6 w-6" />} title="Payments" />
                  <div className="mb-5 flex gap-6">
                    <div>
                      <div className="text-sm text-mauve">Paid</div>
                      <div className="text-xl font-semibold tabular-nums text-ink">{formatMYR(r.paid_sen)}</div>
                      <div className="text-xs text-mauve">{r.payment_count} payment{r.payment_count === 1 ? "" : "s"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-mauve">Planned</div>
                      <div className="text-xl font-semibold tabular-nums text-ink">{formatMYR(r.planned_sen)}</div>
                      <div className="text-xs text-mauve">vs commitments due</div>
                    </div>
                  </div>

                  <h3 className="mb-2 text-sm font-medium text-ink">Category breakdown</h3>
                  {(r.category_breakdown ?? []).length === 0 ? (
                    <p className="text-sm text-mauve">No commitments for this month.</p>
                  ) : (
                    <div className="overflow-hidden rounded-xl">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-blush-100/80">
                            <th className={TH}>Category</th>
                            <th className={`${TH} text-right`}>Amount (RM)</th>
                            <th className={`${TH} text-right`}>% of commitments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.category_breakdown.map((c) => (
                            <tr key={c.category_name} className="border-b border-blush-100/70 last:border-0">
                              <td className={TD}>{c.category_name}</td>
                              <td className={`${TD} text-right font-semibold tabular-nums text-ink`}>{formatMYR(c.amount_sen)}</td>
                              <td className={`${TD} text-right tabular-nums text-mauve`}>
                                {commitTotal === 0 ? "—" : `${Math.round((c.amount_sen / commitTotal) * 100)}%`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>

              {/* Savings progress */}
              <Card>
                <CardHeader icon={<PiggyBank className="h-6 w-6" />} title="Savings progress" />
                {(r.savings_by_goal ?? []).length === 0 ? (
                  <p className="text-sm text-mauve">No savings goals yet.</p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {r.savings_by_goal.map((g) => {
                      const pct = g.target_sen ? Math.min(100, Math.round((g.allocated_total_sen / g.target_sen) * 100)) : null;
                      return (
                        <li key={g.goal_id}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="font-medium text-ink">{g.goal_name}</span>
                            <span className="tabular-nums text-mauve">
                              {formatMYR(g.allocated_total_sen)}
                              {g.target_sen !== null && <> / {formatMYR(g.target_sen)}</>}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[var(--ct-bar-track)]">
                            <div
                              className="h-full rounded-full bg-[var(--ct-bar-fill)]"
                              style={{ width: `${pct ?? 0}%` }}
                            />
                          </div>
                          {pct !== null && <div className="mt-0.5 text-xs text-mauve">{pct}% of target</div>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              {/* 12-month history */}
              <Card>
                <CardHeader icon={<TrendingUp className="h-6 w-6" />} title="12-month history" />
                {history.isLoading ? (
                  <Skeleton className="h-64" />
                ) : lineData.length === 0 ? (
                  <EmptyState icon={ChartPie} hint="No history yet." />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--ct-bar-track)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#3B2B33" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#3B2B33" }} axisLine={false} tickLine={false} />
                        <ReTooltip formatter={(v) => formatMYR(Number(v) * 100)} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="income" name="Income" stroke="var(--ct-donut-pink)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="commitments" name="Commitments" stroke="var(--ct-donut-blue)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="savings" name="Savings" stroke="var(--ct-donut-green)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
