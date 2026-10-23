import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Banknote, ListChecks, MoreVertical, Pencil, PiggyBank, Plus, Trash2, Target } from "lucide-react";
import toast from "react-hot-toast";
import { ApiError, api } from "../lib/api";
import { formatDate, formatMYR, formatNum } from "../lib/format";
import {
  useCategories, useCommitments, useInvalidateMoney, useSavingsGoals,
  useSavingsAllocations,
} from "../lib/queries";
import { useMonthParam } from "../lib/useMonthParam";
import { categoryIcon } from "../lib/icons";
import type { Commitment, SavingsAllocation, SavingsGoal } from "../lib/types";
import { EmptyState, ErrorAlert, Skeleton } from "../components/states";
import { Card, CardHeader, PinkButton } from "../components/ui/primitives";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { CommitmentDialog } from "../components/dialogs/CommitmentDialog";
import { PayDialog } from "../components/dialogs/PayDialog";
import { SavingsGoalDialog } from "../components/dialogs/SavingsGoalDialog";
import { SavingsAllocationDialog } from "../components/dialogs/SavingsAllocationDialog";

type StatusFilter = "active" | "archived" | "all";

const FREQ_LABEL: Record<string, string> = {
  weekly: "Weekly", monthly: "Monthly", yearly: "Yearly", one_time: "One-time",
};

export function Commitments() {
  const invalidateMoney = useInvalidateMoney();
  const commitments = useCommitments(true);
  const categories = useCategories();
  const catIcon: Record<number, string> = {};
  for (const c of categories.data ?? []) catIcon[c.id] = c.icon;
  const [status, setStatus] = useState<StatusFilter>("active");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [paying, setPaying] = useState<Commitment | null>(null);
  const [deleting, setDeleting] = useState<Commitment | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const rows = useMemo(() => {
    let list = commitments.data ?? [];
    if (status === "active") list = list.filter((c) => !c.archived);
    else if (status === "archived") list = list.filter((c) => c.archived);
    if (categoryId !== "all") list = list.filter((c) => String(c.category_id) === categoryId);
    return list;
  }, [commitments.data, status, categoryId]);

  async function toggleArchive(c: Commitment) {
    try {
      await api.updateCommitment(c.id, { archived: !c.archived });
      toast.success(c.archived ? `Unarchived: ${c.name}` : `Archived: ${c.name}`);
      invalidateMoney();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not update commitment");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await api.deleteCommitment(deleting.id);
      toast.success(`Deleted: ${deleting.name}`);
      invalidateMoney();
      setDeleting(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(`${deleting.name} has payment history; archive it instead`);
      } else {
        toast.error(err instanceof ApiError ? err.detail : "Could not delete commitment");
      }
      setDeleting(null);
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          icon={<ListChecks className="h-6 w-6" />}
          title="Commitments"
          subtitle="Your recurring and one-time commitments."
          action={
            <PinkButton onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Add Commitment
            </PinkButton>
          }
        />

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <CategoryFilter value={categoryId} onChange={setCategoryId} />
        </div>

        {commitments.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : commitments.isError ? (
          <ErrorAlert message="Could not load commitments." onRetry={() => void commitments.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            hint="No commitments match this view."
            action={<PinkButton onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4" /> Add commitment</PinkButton>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => {
              const Icon = categoryIcon(catIcon[c.category_id] ?? "Tag");
              return (
                <div key={c.id} className={`flex flex-col gap-3 rounded-2xl border border-blush-100 bg-blush-50/60 p-4 transition-shadow hover:shadow-card dark:border-base-300 dark:bg-base-300 ${c.archived ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-xl bg-blush-100 p-2 text-blush-600"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{c.name}</div>
                        <span className="text-xs text-mauve">{c.category_name}</span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Actions"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditing(c); setDialogOpen(true); }}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPaying(c)}>
                          <Banknote /> Pay occurrence
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void toggleArchive(c)}>
                          {c.archived ? <><ArchiveRestore /> Unarchive</> : <><Archive /> Archive</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-error focus:text-error" onSelect={() => setDeleting(c)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold tabular-nums text-ink">{formatMYR(c.amount_sen)}</span>
                    <span className="rounded-md bg-blush-100 px-2 py-0.5 text-xs font-medium text-blush-700">{FREQ_LABEL[c.frequency]}</span>
                  </div>
                  <div className="text-sm text-mauve">
                    Start {formatDate(c.start_date)}
                    {c.due_date && <> · Due {formatDate(c.due_date)}</>}
                  </div>
                  {c.notes && <div className="border-t border-blush-100 pt-2 text-sm text-mauve dark:border-base-300">{c.notes}</div>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <SavingsCard />

      <CommitmentDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <PayDialog commitment={paying} onClose={() => setPaying(null)} />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete commitment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `This permanently removes "${deleting.name}". If it has payment history it cannot be deleted — archive it instead.`}
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

function CategoryFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const categories = useCategories();
  return (
    <Select value={value} onValueChange={onChange}>
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
  );
}

function SavingsCard() {
  const [month] = useMonthParam();
  const invalidateMoney = useInvalidateMoney();
  const goals = useSavingsGoals();
  const allocations = useSavingsAllocations(month);
  const [goalDialog, setGoalDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<SavingsGoal | null>(null);
  const [allocationDialog, setAllocationDialog] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<SavingsAllocation | null>(null);
  const [allocationGoalId, setAllocationGoalId] = useState<number | null>(null);
  const [deletingAllocation, setDeletingAllocation] = useState<SavingsAllocation | null>(null);
  const [pending, setPending] = useState(false);

  const monthAllocByGoal = useMemo(() => {
    const acc: Record<number, number> = {};
    for (const a of allocations.data ?? []) acc[a.goal_id] = (acc[a.goal_id] ?? 0) + a.amount_sen;
    return acc;
  }, [allocations.data]);

  async function confirmDeleteGoal() {
    if (!deletingGoal) return;
    setPending(true);
    try {
      await api.deleteSavingsGoal(deletingGoal.id);
      toast.success("Savings goal deleted");
      invalidateMoney(month);
      setDeletingGoal(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Goal has allocations; delete them first");
      } else {
        toast.error(err instanceof ApiError ? err.detail : "Could not delete goal");
      }
      setDeletingGoal(null);
    } finally {
      setPending(false);
    }
  }

  async function confirmDeleteAllocation() {
    if (!deletingAllocation) return;
    setPending(true);
    try {
      await api.deleteSavingsAllocation(deletingAllocation.id);
      toast.success("Allocation removed");
      invalidateMoney(month);
      setDeletingAllocation(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not delete allocation");
      setDeletingAllocation(null);
    } finally {
      setPending(false);
    }
  }

  const goalRows = goals.data ?? [];
  const monthTotal = Object.values(monthAllocByGoal).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader
        icon={<PiggyBank className="h-6 w-6" />}
        title="Savings"
        subtitle={`Allocated this month: ${formatMYR(monthTotal)}. Savings are kept separate from spending commitments.`}
        action={
          <div className="flex gap-2">
            <PinkButton onClick={() => { setEditingGoal(null); setGoalDialog(true); }}>
              <Plus className="h-4 w-4" /> New Goal
            </PinkButton>
            <PinkButton
              onClick={() => { setEditingAllocation(null); setAllocationGoalId(null); setAllocationDialog(true); }}
              className="bg-white text-blush-600 shadow-soft hover:bg-blush-50 dark:bg-base-300 dark:text-blush-300"
            >
              <Plus className="h-4 w-4" /> Allocate
            </PinkButton>
          </div>
        }
      />
      {goals.isLoading || allocations.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : goals.isError ? (
        <ErrorAlert error={goals.error} onRetry={() => goals.refetch()} />
      ) : goalRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-mauve">
          <Target className="h-10 w-10 text-blush-300" />
          <p className="text-sm">No savings goals yet. Create one, then allocate money to it monthly.</p>
          <PinkButton onClick={() => { setEditingGoal(null); setGoalDialog(true); }}>
            <Plus className="h-4 w-4" /> Create your first goal
          </PinkButton>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {goalRows.map((g) => {
            const monthAlloc = monthAllocByGoal[g.id] ?? 0;
            const pct = g.target_sen && g.target_sen > 0 ? Math.min((g.allocated_total_sen / g.target_sen) * 100, 100) : null;
            return (
              <div key={g.id} className={`rounded-2xl border border-blush-100 bg-blush-50/60 p-4 dark:border-base-300 dark:bg-base-300 ${g.archived ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-sage-100 p-2 text-sage-600"><PiggyBank className="h-5 w-5" /></div>
                    <div>
                      <div className="font-medium text-ink">{g.name}</div>
                      <div className="text-xs text-mauve">
                        {formatMYR(g.allocated_total_sen)} saved
                        {g.target_sen ? ` of ${formatMYR(g.target_sen)} target` : ""}
                        {g.target_date ? ` · by ${formatDate(g.target_date)}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="mr-1 text-xs font-medium text-mauve">
                      {formatMYR(monthAlloc)} this month
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Allocate to ${g.name}`}
                      onClick={() => { setEditingAllocation(null); setAllocationGoalId(g.id); setAllocationDialog(true); }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Goal actions"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditingGoal(g); setGoalDialog(true); }}>
                          <Pencil /> Edit goal
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-error focus:text-error" onSelect={() => setDeletingGoal(g)}>
                          <Trash2 /> Delete goal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {pct !== null && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--ct-bar-track)]">
                    <div className="h-full rounded-full bg-sage-500" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {pct !== null && <div className="mt-1 text-right text-xs text-mauve">{pct.toFixed(0)}% of target</div>}
              </div>
            );
          })}

          {(allocations.data ?? []).length > 0 && (
            <div className="overflow-hidden rounded-xl">
              <table className="w-full">
                <thead>
                  <tr className="bg-blush-100/80">
                    <th className="px-3 py-2.5 text-left text-[13px] font-medium text-mauve">Goal</th>
                    <th className="px-3 py-2.5 text-right text-[13px] font-medium text-mauve">Amount (RM)</th>
                    <th className="px-3 py-2.5 text-left text-[13px] font-medium text-mauve">Date</th>
                    <th className="px-3 py-2.5 text-right text-[13px] font-medium text-mauve">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(allocations.data ?? []).map((a) => (
                    <tr key={a.id} className="border-b border-blush-100/70 last:border-0">
                      <td className="px-3 py-3 text-sm font-medium text-ink">{a.goal_name}</td>
                      <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums">{formatNum(a.amount_sen)}</td>
                      <td className="px-3 py-3 text-sm text-mauve">{formatDate(a.allocation_date)}</td>
                      <td className="px-3 py-3">
                        <span className="flex items-center justify-end gap-1.5">
                          <button aria-label="Edit allocation" onClick={() => { setEditingAllocation(a); setAllocationDialog(true); }}
                            className="rounded-lg p-2 text-blush-500 transition-colors hover:bg-blush-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button aria-label="Delete allocation" onClick={() => setDeletingAllocation(a)}
                            className="rounded-lg p-2 text-blush-500 transition-colors hover:bg-blush-100">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <SavingsGoalDialog open={goalDialog} onOpenChange={setGoalDialog} editing={editingGoal} />
      <SavingsAllocationDialog
        open={allocationDialog}
        onOpenChange={setAllocationDialog}
        editing={editingAllocation}
        defaultGoalId={allocationGoalId}
      />

      <AlertDialog open={deletingGoal !== null} onOpenChange={(o) => !o && setDeletingGoal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete savings goal?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{deletingGoal?.name}". Goals with allocations cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={(e) => { e.preventDefault(); void confirmDeleteGoal(); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingAllocation !== null} onOpenChange={(o) => !o && setDeletingAllocation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove allocation?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {formatMYR(deletingAllocation?.amount_sen ?? 0)} from{" "}
              {deletingAllocation?.goal_name}. Totals recalculate immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={(e) => { e.preventDefault(); void confirmDeleteAllocation(); }}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
