import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ApiError, api } from "../../lib/api";
import { formatMYR, parseAmountToSen, todayISO } from "../../lib/format";
import { keys, useInvalidateMoney } from "../../lib/queries";
import type { Income } from "../../lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Income | null;
  defaultDate?: string;
}

interface FormState {
  source_name: string;
  amount: string;
  income_date: string;
  description: string;
}

export function IncomeDialog({ open, onOpenChange, editing, defaultDate }: Props) {
  const qc = useQueryClient();
  const invalidateMoney = useInvalidateMoney();
  const [form, setForm] = useState<FormState>({ source_name: "", amount: "", income_date: defaultDate ?? todayISO(), description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { source_name: editing.source_name, amount: (editing.amount_sen / 100).toString(), income_date: editing.income_date, description: editing.description ?? "" }
          : { source_name: "", amount: "", income_date: defaultDate ?? todayISO(), description: "" },
      );
      setErrors({});
    }
  }, [open, editing, defaultDate]);

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.source_name.trim()) errs.source_name = "Source is required";
    const sen = parseAmountToSen(form.amount);
    if (sen === null) errs.amount = "Enter an amount greater than zero";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.income_date)) errs.income_date = "Pick a valid date";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !validate()) return;
    setPending(true);
    const body = {
      source_name: form.source_name.trim(),
      amount_sen: parseAmountToSen(form.amount)!,
      income_date: form.income_date,
      description: form.description.trim() || null,
    };
    try {
      if (editing) {
        await api.updateIncome(editing.id, body);
        toast.success(`Income updated: ${formatMYR(body.amount_sen)}`);
      } else {
        await api.createIncome(body);
        toast.success(`Income added: ${formatMYR(body.amount_sen)}`);
      }
      invalidateMoney();
      void qc.invalidateQueries({ queryKey: keys.incomes() });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) setErrors({ form: err.detail });
      toast.error("Could not save income");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Income" : "Add Income"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="form-control">
            <span className="label-text mb-1 text-sm">Source</span>
            <input
              className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
              value={form.source_name}
              onChange={(e) => set("source_name", e.target.value)}
              placeholder="e.g. Salary"
            />
            {errors.source_name && <span className="text-sm text-error mt-1">{errors.source_name}</span>}
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-sm">Amount (RM)</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary tabular-nums"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="0.00"
            />
            {errors.amount && <span className="text-sm text-error mt-1">{errors.amount}</span>}
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-sm">Date</span>
            <input
              type="date"
              className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
              value={form.income_date}
              onChange={(e) => set("income_date", e.target.value)}
            />
            {errors.income_date && <span className="text-sm text-error mt-1">{errors.income_date}</span>}
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-sm">Description (optional)</span>
            <input
              className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          {errors.form && <div className="text-sm text-error">{errors.form}</div>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <span className="loading loading-spinner loading-sm" />}
              {editing ? "Save changes" : "Add income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
