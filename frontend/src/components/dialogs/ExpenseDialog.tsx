import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ApiError, api } from "../../lib/api";
import { formatMYR, parseAmountToSen, todayISO } from "../../lib/format";
import { keys, useCategories, useInvalidateMoney } from "../../lib/queries";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExpenseDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const invalidateMoney = useInvalidateMoney();
  const categories = useCategories();
  const [amount, setAmount] = useState("");
  const [txnDate, setTxnDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(""); setTxnDate(todayISO()); setDescription(""); setCategoryId(""); setErrors({});
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const sen = parseAmountToSen(amount);
    if (sen === null) errs.amount = "Enter an amount greater than zero";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txnDate)) errs.txnDate = "Pick a valid date";
    setErrors(errs);
    if (pending || Object.keys(errs).length > 0) return;
    setPending(true);
    try {
      await api.createExpense({
        amount_sen: sen!,
        txn_date: txnDate,
        description: description.trim() || null,
        category_id: categoryId ? Number(categoryId) : null,
      });
      toast.success(`Expense added: ${formatMYR(sen!)}`);
      invalidateMoney();
      void qc.invalidateQueries({ queryKey: keys.transactions() });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) setErrors({ form: err.detail });
      toast.error("Could not add expense");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="form-control">
            <span className="label-text mb-1 text-sm">Amount (RM)</span>
            <input
              type="number" step="0.01" min="0.01"
              className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary tabular-nums"
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
            />
            {errors.amount && <span className="text-sm text-error mt-1">{errors.amount}</span>}
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-sm">Date</span>
            <input
              type="date"
              className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
              value={txnDate} onChange={(e) => setTxnDate(e.target.value)}
            />
            {errors.txnDate && <span className="text-sm text-error mt-1">{errors.txnDate}</span>}
          </label>
          <div>
            <span className="label-text mb-1 block text-sm">Category (optional)</span>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Uncategorised" />
              </SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="form-control">
            <span className="label-text mb-1 text-sm">Description (optional)</span>
            <input
              className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {errors.form && <div className="text-sm text-error">{errors.form}</div>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <span className="loading loading-spinner loading-sm" />}
              Add expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
