import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ApiError, api } from "../../lib/api";
import { formatDate, formatMYR } from "../../lib/format";
import { useInvalidateMoney, useOccurrences } from "../../lib/queries";
import type { Commitment } from "../../lib/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { EmptyState } from "../states";
import { BadgeCheck } from "lucide-react";

interface Props {
  commitment: Commitment | null;
  month?: string;
  onClose: () => void;
}

export function PayDialog({ commitment, month, onClose }: Props) {
  const invalidateMoney = useInvalidateMoney();
  const occurrences = useOccurrences(month);
  const [payingDate, setPayingDate] = useState<string | null>(null);

  const mine = useMemo(
    () => (occurrences.data ?? []).filter((o) => o.commitment_id === commitment?.id),
    [occurrences.data, commitment],
  );

  async function pay(occurrenceDate: string) {
    if (!commitment || payingDate) return;
    setPayingDate(occurrenceDate);
    try {
      await api.pay(commitment.id, occurrenceDate);
      toast.success(`Marked paid: ${commitment.name} (${formatDate(occurrenceDate)})`);
      invalidateMoney();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not record payment");
    } finally {
      setPayingDate(null);
    }
  }

  return (
    <Dialog open={commitment !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay: {commitment?.name}</DialogTitle>
        </DialogHeader>
        {occurrences.isLoading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse bg-base-300 rounded-xl" />
            <div className="h-12 animate-pulse bg-base-300 rounded-xl" />
          </div>
        ) : mine.length === 0 ? (
          <EmptyState icon={BadgeCheck} hint="No occurrences for this commitment in the selected month." />
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((o) => (
              <li key={o.occurrence_date} className="flex items-center justify-between rounded-xl border border-base-300 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{formatDate(o.occurrence_date)}</div>
                  <div className="text-xs tabular-nums text-base-content/60">{formatMYR(o.amount_sen)}</div>
                </div>
                {o.status === "paid" ? (
                  <span className="badge badge-success rounded-badge text-white">Paid</span>
                ) : (
                  <Button
                    size="sm"
                    variant={o.status === "overdue" ? "error" : "primary"}
                    disabled={payingDate !== null}
                    onClick={() => pay(o.occurrence_date)}
                  >
                    {payingDate === o.occurrence_date && <span className="loading loading-spinner loading-xs" />}
                    Mark paid
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
