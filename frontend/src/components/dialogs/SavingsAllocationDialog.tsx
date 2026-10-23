import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "../../lib/api";
import { parseAmountToSen, todayISO } from "../../lib/format";
import { useSavingsGoals } from "../../lib/queries";
import type { SavingsAllocation } from "../../lib/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: SavingsAllocation | null;
  defaultGoalId?: number | null;
}

interface FormState {
  goal_id: string;
  amount: string;
  allocation_date: string;
  note: string;
}

export function SavingsAllocationDialog({ open, onOpenChange, editing, defaultGoalId }: Props) {
  const qc = useQueryClient();
  const goals = useSavingsGoals();
  const [form, setForm] = useState<FormState>({ goal_id: "", amount: "", allocation_date: todayISO(), note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        goal_id: String(editing?.goal_id ?? defaultGoalId ?? goals.data?.[0]?.id ?? ""),
        amount: editing ? (editing.amount_sen / 100).toString() : "",
        allocation_date: editing?.allocation_date ?? todayISO(),
        note: editing?.note ?? "",
      });
      setErrors({});
    }
  }, [open, editing, defaultGoalId, goals.data]);

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.goal_id) e.goal_id = "Choose a savings goal";
    const sen = parseAmountToSen(form.amount);
    if (sen === null || sen <= 0) e.amount = "Enter an amount greater than zero";
    if (!form.allocation_date) e.allocation_date = "Pick a date";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setPending(true);
    try {
      const sen = parseAmountToSen(form.amount);
      if (editing) {
        await api.updateSavingsAllocation(editing.id, {
          goal_id: Number(form.goal_id),
          amount_sen: sen!,
          allocation_date: form.allocation_date,
          note: form.note.trim() || null,
        });
        toast.success("Allocation updated");
      } else {
        await api.createSavingsAllocation({
          goal_id: Number(form.goal_id),
          amount_sen: sen!,
          allocation_date: form.allocation_date,
          note: form.note.trim() || null,
        });
        toast.success("Savings allocated");
      }
      await qc.invalidateQueries({ queryKey: ["savings-goals"] });
      await qc.invalidateQueries({ queryKey: ["allocations"] });
      await qc.invalidateQueries({ queryKey: ["summary"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not save allocation");
    } finally {
      setPending(false);
    }
  }

  const field = "w-full rounded-xl border border-base-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blush-400 focus:ring-2 focus:ring-blush-200 dark:bg-base-300";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit allocation" : "Allocate to savings"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Savings goal</label>
            <Select value={form.goal_id} onValueChange={(v) => set("goal_id", v)}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Choose a goal" />
              </SelectTrigger>
              <SelectContent>
                {(goals.data ?? []).filter((g) => !g.archived).map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.goal_id && <p className="mt-1 text-xs font-medium text-error">{errors.goal_id}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Amount (RM)</label>
              <input
                className={field}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
              {errors.amount && <p className="mt-1 text-xs font-medium text-error">{errors.amount}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Date</label>
              <input
                className={field}
                type="date"
                value={form.allocation_date}
                onChange={(e) => set("allocation_date", e.target.value)}
              />
              {errors.allocation_date && <p className="mt-1 text-xs font-medium text-error">{errors.allocation_date}</p>}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Note (optional)</label>
            <input
              className={field}
              placeholder="e.g. October transfer"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending} className="bg-blush-500 text-white hover:bg-blush-600">
              {editing ? "Save changes" : "Allocate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
