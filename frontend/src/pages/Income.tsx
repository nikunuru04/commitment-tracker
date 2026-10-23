import { useState } from "react";
import { Banknote, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { ApiError, api } from "../lib/api";
import { formatDate, formatMYR, formatMonthLong, formatNum } from "../lib/format";
import { useIncomes, useInvalidateMoney } from "../lib/queries";
import { useMonthParam } from "../lib/useMonthParam";
import type { Income } from "../lib/types";
import { ErrorAlert, Skeleton } from "../components/states";
import {
  Card, CardHeader, IconCircle, PinkButton, TH, TD,
} from "../components/ui/primitives";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { IncomeDialog } from "../components/dialogs/IncomeDialog";

export function Income() {
  const invalidateMoney = useInvalidateMoney();
  const [month] = useMonthParam();
  const incomes = useIncomes(month);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [deleting, setDeleting] = useState<Income | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const rows = incomes.data ?? [];
  const totalSen = rows.reduce((acc, r) => acc + r.amount_sen, 0);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await api.deleteIncome(deleting.id);
      toast.success("Income deleted");
      invalidateMoney(month);
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not delete income");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          icon={<Wallet className="h-6 w-6" />}
          title="Income"
          subtitle={`Manage your income sources for ${formatMonthLong(month)}.`}
          action={
            <PinkButton onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Income
            </PinkButton>
          }
        />
        {incomes.isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : incomes.isError ? (
          <ErrorAlert error={incomes.error} onRetry={() => incomes.refetch()} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-mauve">
            <Banknote className="h-10 w-10 text-blush-300" />
            <p className="text-sm">No income recorded for {formatMonthLong(month)} yet.</p>
            <PinkButton onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add your first income
            </PinkButton>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl">
            <table className="w-full">
              <thead>
                <tr className="bg-blush-100/80">
                  <th className={`${TH} w-[34%]`}>Source</th>
                  <th className={`${TH} text-right`}>Amount (RM)</th>
                  <th className={`${TH} hidden md:table-cell`}>Date</th>
                  <th className={`${TH} hidden sm:table-cell`}>Notes</th>
                  <th className={`${TH} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inc) => (
                  <tr key={inc.id} className="border-b border-blush-100/70 last:border-0">
                    <td className={TD}>
                      <span className="flex items-center gap-3 font-medium text-ink">
                        <IconCircle className="bg-blush-100 text-blush-600">
                          <Banknote className="h-4 w-4" />
                        </IconCircle>
                        {inc.source_name}
                      </span>
                    </td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>{formatNum(inc.amount_sen)}</td>
                    <td className={`${TD} hidden text-mauve md:table-cell`}>{formatDate(inc.income_date)}</td>
                    <td className={`${TD} hidden text-mauve sm:table-cell`}>{inc.description || "—"}</td>
                    <td className={TD}>
                      <span className="flex items-center justify-end gap-1.5">
                        <button
                          aria-label={`Edit ${inc.source_name}`}
                          onClick={() => { setEditing(inc); setDialogOpen(true); }}
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
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blush-50 dark:bg-base-300">
                  <td className={`${TD} font-semibold text-ink`}>Total for month</td>
                  <td className={`${TD} text-right font-bold text-blush-700 tabular-nums`}>{formatMYR(totalSen)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <IncomeDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} defaultDate={`${month}-01`} />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
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
    </div>
  );
}
