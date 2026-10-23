import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { ApiError, api } from "../lib/api";
import { addMonths, currentMonth, formatDate, formatMYR, formatMonth, todayISO } from "../lib/format";
import { useInvalidateMoney, useOccurrences } from "../lib/queries";
import type { Occurrence } from "../lib/types";
import { EmptyState, ErrorAlert, Skeleton } from "../components/states";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { cn } from "../lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_CHIP: Record<string, string> = {
  paid: "bg-sage-100 text-sage-700",
  pending: "bg-sun-100 text-sun-600",
  overdue: "bg-red-100 text-red-600",
};

export function Calendar() {
  const [month, setMonth] = useState(currentMonth());
  const occurrences = useOccurrences(month);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [payingDate, setPayingDate] = useState<string | null>(null);
  const invalidateMoney = useInvalidateMoney();

  const byDay: Record<string, Occurrence[]> = {};
  for (const o of occurrences.data ?? []) (byDay[o.occurrence_date] ??= []).push(o);

  const overdue = useMemo(() => (occurrences.data ?? []).filter((o) => o.status === "overdue"), [occurrences.data]);

  const grid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday-start offset
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  async function markPaid(o: Occurrence) {
    if (payingDate) return;
    setPayingDate(o.occurrence_date);
    try {
      await api.pay(o.commitment_id, o.occurrence_date);
      toast.success(`Marked paid: ${o.commitment_name}`);
      invalidateMoney();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not record payment");
    } finally {
      setPayingDate(null);
    }
  }

  const dayOccurrences = selectedDay ? (byDay[selectedDay] ?? []) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-28 text-center font-medium">{formatMonth(month)}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(currentMonth())}>Today</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {([["Paid", "bg-sage-100 text-sage-700"], ["Pending", "bg-sun-100 text-sun-600"], ["Overdue", "bg-red-100 text-red-600"]] as const).map(([label, cls]) => (
          <span key={label} className={cn("rounded-full px-3 py-1 text-xs font-medium", cls)}>
            {label}
          </span>
        ))}
      </div>

      {occurrences.isLoading ? (
        <Skeleton className="h-96" />
      ) : occurrences.isError ? (
        <ErrorAlert message="Could not load occurrences." onRetry={() => void occurrences.refetch()} />
      ) : (
        <Card className="p-4">
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-mauve">
            {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((date, i) =>
              date === null ? (
                <div key={`e${i}`} className="min-h-20 rounded-xl bg-blush-50 dark:bg-base-200/50" />
              ) : (
                <button
                  key={date}
                  onClick={() => (byDay[date]?.length ?? 0) > 0 && setSelectedDay(date)}
                  className={cn(
                    "min-h-20 rounded-xl border border-blush-100/70 p-1.5 text-left align-top transition-colors dark:border-base-300",
                    date === todayISO() ? "ring-2 ring-blush-500" : "hover:bg-blush-50 dark:hover:bg-base-200",
                  )}
                >
                  <span className={cn("text-xs", date === todayISO() ? "font-semibold text-blush-600" : "text-mauve")}>
                    {Number(date.slice(-2))}
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {(byDay[date] ?? []).slice(0, 3).map((o) => (
                      <span key={`${o.commitment_id}-${date}`} className={cn("flex max-w-full items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-tight", STATUS_CHIP[o.status])}>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                        <span className="tabular-nums">{formatMYR(o.amount_sen)}</span>
                      </span>
                    ))}
                    {(byDay[date]?.length ?? 0) > 3 && (
                      <span className="text-[10px] text-base-content/50">+{(byDay[date] ?? []).length - 3} more</span>
                    )}
                  </div>
                </button>
              ),
            )}
          </div>

          {/* Overdue section */}
          {overdue.length > 0 && (
            <div className="mt-5 border-t border-blush-100/70 pt-4">
              <h2 className="mb-3 font-semibold text-blush-700">Overdue</h2>
              <ul className="flex flex-col divide-y divide-blush-100/70">
                {overdue.map((o) => (
                  <li key={`${o.commitment_id}-${o.occurrence_date}`} className="flex items-center gap-3 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate text-ink">{o.commitment_name}</div>
                      <div className="text-xs text-mauve">was due {formatDate(o.occurrence_date)}</div>
                    </div>
                    <span className="text-sm tabular-nums text-ink">{formatMYR(o.amount_sen)}</span>
                    <Button size="sm" variant="error" disabled={payingDate !== null} onClick={() => void markPaid(o)}>
                      {payingDate === o.occurrence_date && <span className="loading loading-spinner loading-xs" />}
                      Mark paid
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Day detail dialog */}
      <Dialog open={selectedDay !== null} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {selectedDay && formatDate(selectedDay)}
            </DialogTitle>
          </DialogHeader>
          {dayOccurrences.length === 0 ? (
            <EmptyState icon={CalendarDays} hint="Nothing due on this day." />
          ) : (
            <ul className="flex flex-col gap-2">
              {dayOccurrences.map((o) => (
                <li key={o.commitment_id} className="flex items-center justify-between gap-2 rounded-xl border border-base-300 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{o.commitment_name}</div>
                    <div className="text-xs text-base-content/60 tabular-nums">{formatMYR(o.amount_sen)}</div>
                  </div>
                  {o.status === "paid" ? (
                    <span className="inline-block rounded-md bg-sage-100 px-2.5 py-1 text-xs font-medium text-sage-700">Paid</span>
                  ) : (
                    <Button size="sm" variant={o.status === "overdue" ? "error" : "primary"} disabled={payingDate !== null} onClick={() => void markPaid(o)}>
                      {payingDate === o.occurrence_date && <span className="loading loading-spinner loading-xs" />}
                      Mark paid
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedDay(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
