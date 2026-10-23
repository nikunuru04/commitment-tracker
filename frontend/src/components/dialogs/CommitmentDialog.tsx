import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ApiError, api } from "../../lib/api";
import { formatMYR, parseAmountToSen, todayISO } from "../../lib/format";
import { keys, useCategories, useInvalidateMoney } from "../../lib/queries";
import type { Commitment, Frequency } from "../../lib/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One-time" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Commitment | null;
}

interface FormState {
  name: string;
  category_id: string;
  amount: string;
  frequency: Frequency;
  start_date: string;
  due_date: string;
  notes: string;
}

export function CommitmentDialog({ open, onOpenChange, editing }: Props) {
  const qc = useQueryClient();
  const invalidateMoney = useInvalidateMoney();
  const categories = useCategories();
  const [form, setForm] = useState<FormState>({
    name: "", category_id: "", amount: "", frequency: "monthly", start_date: todayISO(), due_date: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catPending, setCatPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              name: editing.name,
              category_id: String(editing.category_id),
              amount: (editing.amount_sen / 100).toString(),
              frequency: editing.frequency,
              start_date: editing.start_date,
              due_date: editing.due_date ?? "",
              notes: editing.notes ?? "",
            }
          : { name: "", category_id: "", amount: "", frequency: "monthly", start_date: todayISO(), due_date: "", notes: "" },
      );
      setErrors({});
    }
  }, [open, editing]);

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.category_id) errs.category_id = "Pick a category";
    if (parseAmountToSen(form.amount) === null) errs.amount = "Enter an amount greater than zero";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.start_date)) errs.start_date = "Pick a valid start date";
    if (form.due_date && form.due_date < form.start_date) errs.due_date = "Due date cannot be before start date";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !validate()) return;
    setPending(true);
    const body = {
      name: form.name.trim(),
      category_id: Number(form.category_id),
      amount_sen: parseAmountToSen(form.amount)!,
      frequency: form.frequency,
      start_date: form.start_date,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        await api.updateCommitment(editing.id, body);
        toast.success(`Commitment updated: ${body.name}`);
      } else {
        await api.createCommitment(body);
        toast.success(`Commitment added: ${body.name} (${formatMYR(body.amount_sen)})`);
      }
      invalidateMoney();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) setErrors({ form: err.detail });
      toast.error("Could not save commitment");
    } finally {
      setPending(false);
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim() || catPending) return;
    setCatPending(true);
    try {
      const cat = await api.createCategory(newCatName.trim());
      await qc.invalidateQueries({ queryKey: keys.categories() });
      set("category_id", String(cat.id));
      setNewCatName("");
      setCatDialogOpen(false);
      toast.success(`Category created: ${cat.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not create category");
    } finally {
      setCatPending(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Commitment" : "Add Commitment"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Name</span>
              <input
                className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Car loan"
              />
              {errors.name && <span className="text-sm text-error mt-1">{errors.name}</span>}
            </label>
            <div>
              <span className="label-text mb-1 block text-sm">Category</span>
              <div className="flex gap-2">
                <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setCatDialogOpen(true)}>New</Button>
              </div>
              {errors.category_id && <span className="text-sm text-error mt-1">{errors.category_id}</span>}
            </div>
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Amount (RM)</span>
              <input
                type="number" step="0.01" min="0.01"
                className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary tabular-nums"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
              />
              {errors.amount && <span className="text-sm text-error mt-1">{errors.amount}</span>}
            </label>
            <div>
              <span className="label-text mb-1 block text-sm">Frequency</span>
              <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as Frequency }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-control">
                <span className="label-text mb-1 text-sm">Start date</span>
                <input
                  type="date"
                  className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
                {errors.start_date && <span className="text-sm text-error mt-1">{errors.start_date}</span>}
              </label>
              <label className="form-control">
                <span className="label-text mb-1 text-sm">Due date (optional)</span>
                <input
                  type="date"
                  className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
                  value={form.due_date}
                  onChange={(e) => set("due_date", e.target.value)}
                />
                {errors.due_date && <span className="text-sm text-error mt-1">{errors.due_date}</span>}
              </label>
            </div>
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Notes (optional)</span>
              <textarea
                className="textarea textarea-bordered w-full rounded-box bg-base-100 border-base-300 focus:border-primary"
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </label>
            {errors.form && <div className="text-sm text-error">{errors.form}</div>}
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending && <span className="loading loading-spinner loading-sm" />}
                {editing ? "Save changes" : "Add commitment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New category inline dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>Create a category to file this commitment under.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createCategory} className="flex flex-col gap-4">
            <input
              className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Category name"
              autoFocus
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={catPending || !newCatName.trim()}>
                {catPending && <span className="loading loading-spinner loading-sm" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
