import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-base-300 rounded-xl ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-6" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, hint, action }: { icon: LucideIcon; hint: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="rounded-2xl bg-primary/10 p-4 text-primary">
        <Icon className="h-8 w-8" />
      </div>
      <p className="text-sm text-base-content/60">{hint}</p>
      {action}
    </div>
  );
}

export function ErrorAlert({ message, error, onRetry }: { message?: string; error?: unknown; onRetry: () => void }) {
  const text = message ?? (error instanceof Error ? error.message : "Something went wrong");
  return (
    <div role="alert" className="alert alert-error rounded-2xl">
      <span className="text-sm">{text}</span>
      <button className="btn btn-sm btn-ghost text-white" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  negative = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="bg-base-100 border border-base-300 rounded-2xl shadow-soft p-5 flex items-center gap-4">
      <div className={`rounded-2xl p-3 ${negative ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-base-content/60">{label}</div>
        <div className={`text-lg xl:text-xl font-semibold tabular-nums whitespace-nowrap ${negative ? "text-error" : ""}`}>{value}</div>
      </div>
    </div>
  );
}
