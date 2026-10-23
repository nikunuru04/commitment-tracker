import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "../../lib/api";
import { parseAmountToSen } from "../../lib/format";
import type { SavingsGoal } from "../../lib/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: SavingsGoal | null;
}

interface FormState {
  name: string;
  target: string;
  target_date: string;
  notes: string;
}

export function SavingsGoalDialog({ open, onOpenChange, editing }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({ name: "", target: "", target_date: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: editing?.name ?? "",
        target: editing?.target_sen != null ? (editing.target_sen / 100).toString() : "",
        target_date: editing?.target_date ?? "",
        notes: editing?.notes ?? "",
      });
      setErrors({});
    }
  }, [open, editing]);

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Goal name is required";
    if (form.target) {
      const sen = parseAmountToSen(form.target);
      if (sen === null || sen <= 0) e.target = "Enter a target greater than zero";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setPending(true);
    try {
      const body = {
        name: form.name.trim(),
        target_sen: form.target ? parseAmountToSen(form.target) : null,
        target_date: form.target_date || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await api.updateSavingsGoal(editing.id, body);
        toast.success("Savings goal updated");
      } else {
        await api.createSavingsGoal(body);
        toast.success("Savings goal created");
      }
      await qc.invalidateQueries({ queryKey: ["savings-goals"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not save savings goal");
    } finally {
      setPending(false);
    }
  }

  const field = "w-full rounded-xl border border-base-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blush-400 focus:ring-2 focus:ring-blush-200 dark:bg-base-300";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit savings goal" : "New savings goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Goal name</label>
            <input
              className={field}
              placeholder="e.g. Emergency fund"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {errors.name && <p className="mt-1 text-xs font-medium text-error">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Target (RM)</label>
              <input
                className={field}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                value={form.target}
                onChange={(e) => set("target", e.target.value)}
              />
              {errors.target && <p className="mt-1 text-xs font-medium text-error">{errors.target}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Target date</label>
              <input
                className={field}
                type="date"
                value={form.target_date}
                onChange={(e) => set("target_date", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Notes (optional)</label>
            <textarea
              className={field}
              rows={2}
              placeholder="What is this savings for?"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending} className="bg-blush-500 text-white hover:bg-blush-600">
              {editing ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
