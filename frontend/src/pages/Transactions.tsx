import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { ApiError, api } from "../lib/api";
import { formatDate, formatMYR } from "../lib/format";
import { keys, useCategories, useInvalidateMoney, useTransactions } from "../lib/queries";
import { useMonthParam } from "../lib/useMonthParam";
import type { Transaction } from "../lib/types";
import { EmptyState, ErrorAlert, TableSkeleton } from "../components/states";
import { MonthPicker } from "../components/ui/month-picker";
import { Button } from "../components/ui/button";
import { Card, TH, TD } from "../components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { ExpenseDialog } from "../components/dialogs/ExpenseDialog";

type TypeFilter = "all" | "payment" | "expense";

export function Transactions() {
  const qc = useQueryClient();
  const invalidateMoney = useInvalidateMoney();
  const [month, setMonth] = useMonthParam();
  const [type, setType] = useState<TypeFilter>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const categories = useCategories();
  const filters = {
    month,
    type: type === "all" ? undefined : type,
    category_id: categoryId === "all" ? undefined : Number(categoryId),
  };
  const txns = useTransactions(filters);
  const rows = txns.data ?? [];

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await api.deleteTransaction(deleting.id);
      if (deleting.type === "payment") {
        toast.success(`Payment deleted — removes payment status from "${deleting.commitment_name}"`);
      } else {
        toast.success("Expense deleted");
      }
      invalidateMoney();
      void qc.invalidateQueries({ queryKey: keys.transactions() });
      setDeleting(null);
      setDetail(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not delete transaction");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} onChange={setMonth} />
          <Button onClick={() => setExpenseOpen(true)}><Plus className="h-4 w-4" /> Add Expense</Button>
        </div>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <Tabs value={type} onValueChange={(v) => setType(v as TypeFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="payment">Payments</TabsTrigger>
            <TabsTrigger value="expense">Expenses</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories.data ?? []).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-base-content/50 w-full sm:w-auto">
          Payments are recorded from the Commitments page when you mark an occurrence paid.
        </p>
      </Card>

      <div className="overflow-hidden rounded-xl bg-white shadow-card dark:bg-base-100">
        {txns.isLoading ? (
          <TableSkeleton cols={5} />
        ) : txns.isError ? (
          <div className="p-4"><ErrorAlert message="Could not load transactions." onRetry={() => void txns.refetch()} /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            hint="No transactions match these filters."
            action={<Button size="sm" onClick={() => setExpenseOpen(true)}><Plus className="h-4 w-4" /> Add expense</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-blush-100/80">
                  <th className={TH}>Date</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Description</th>
                  <th className={TH}>Category</th>
                  <th className={`${TH} text-right`}>Amount (RM)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-blush-100/70 last:border-0 hover:bg-blush-50 dark:hover:bg-base-200"
                    onClick={() => setDetail(t)}
                  >
                    <td className={`${TD} text-mauve`}>{formatDate(t.txn_date)}</td>
                    <td className={TD}>
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${t.type === "payment" ? "bg-sky-100 text-sky-700" : "bg-blush-100 text-blush-700"}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className={`${TD} max-w-56 truncate`}>{t.description ?? t.commitment_name ?? "—"}</td>
                    <td className={`${TD} text-mauve`}>{t.category_name ?? "—"}</td>
                    <td className={`${TD} text-right font-semibold tabular-nums text-ink`}>{formatMYR(t.amount_sen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} />

      {/* Detail dialog */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction detail</DialogTitle>
            {detail && (
              <DialogDescription>
                {detail.type === "payment" ? "Commitment payment" : "Expense"} · {formatDate(detail.txn_date)}
              </DialogDescription>
            )}
          </DialogHeader>
          {detail && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-base-content/60">Amount</dt>
              <dd className="tabular-nums text-right font-semibold">{formatMYR(detail.amount_sen)}</dd>
              <dt className="text-base-content/60">Type</dt>
              <dd className="text-right capitalize">{detail.type}</dd>
              <dt className="text-base-content/60">Description</dt>
              <dd className="text-right">{detail.description ?? "—"}</dd>
              <dt className="text-base-content/60">Category</dt>
              <dd className="text-right">{detail.category_name ?? "—"}</dd>
              {detail.type === "payment" && (
                <>
                  <dt className="text-base-content/60">Commitment</dt>
                  <dd className="text-right">{detail.commitment_name ?? "—"}</dd>
                  <dt className="text-base-content/60">Occurrence date</dt>
                  <dd className="text-right">{detail.occurrence_date ? formatDate(detail.occurrence_date) : "—"}</dd>
                </>
              )}
            </dl>
          )}
          <DialogFooter>
            <Button variant="error" onClick={() => detail && setDeleting(detail)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.type === "payment"
                ? "This removes the payment status from the commitment occurrence."
                : "This permanently removes this expense."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deletePending} onClick={(e) => { e.preventDefault(); void confirmDelete(); }}>
              {deletePending && <span className="loading loading-spinner loading-sm" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
