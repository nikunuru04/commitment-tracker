import type { ReactNode } from "react";


/** Shared visual primitives for the reference-matching design (white cards on blush background). */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-card dark:bg-base-100 ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  icon, title, subtitle, action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-blush-500">{icon}</span>
        <div>
          <h2 className="text-[17px] font-bold leading-6 text-ink">{title}</h2>
          {subtitle && <p className="text-[13px] text-mauve">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function IconCircle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${className}`}>
      {children}
    </span>
  );
}

export function PinkIconCircle({ children }: { children: ReactNode }) {
  return <IconCircle className="bg-blush-100 text-blush-600">{children}</IconCircle>;
}

export type BadgeStatus = "paid" | "pending" | "overdue" | "allocated";

const BADGE_STYLES: Record<BadgeStatus, string> = {
  paid: "bg-sage-100 text-sage-700",
  pending: "bg-sun-100 text-sun-600",
  overdue: "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300",
  allocated: "bg-sky-100 text-sky-700",
};

const BADGE_LABELS: Record<BadgeStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
  allocated: "Allocated",
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${BADGE_STYLES[status]}`}>
      {BADGE_LABELS[status]}
    </span>
  );
}

export const TH = "px-3 py-2.5 text-left text-[13px] font-medium text-mauve";
export const TD = "px-3 py-3 text-sm";

export function PinkButton({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl bg-blush-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-blush-600 ${className}`}
    >
      {children}
    </button>
  );
}
