const myr = new Intl.NumberFormat("ms-MY", {
  style: "currency",
  currency: "MYR",
});

/** Format integer sen as `RM 1,234.56`. Negative uses proper minus sign. */
export function formatMYR(sen: number): string {
  const s = myr.format(Math.abs(sen) / 100).replace("RM", "RM ");
  return sen < 0 ? `−${s}` : s;
}

/** `2026-03` -> `March 2026` (full month name, dashboard header) */
export function formatMonthLong(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[m - 1]} ${y}`;
}

const plainNum = new Intl.NumberFormat("ms-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format integer sen as `1,234.56` (no RM prefix; table Amount (RM) columns). */
export function formatNum(sen: number): string {
  return plainNum.format(Math.abs(sen) / 100);
}

/** Format integer sen as `RM 3,000` (no decimals; donut centre). */
export function formatRMShort(sen: number): string {
  return `RM ${new Intl.NumberFormat("ms-MY", { maximumFractionDigits: 0 }).format(Math.round(sen / 100))}`;
}

/** `2026-03-12` -> `12 Mar 2026` */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

/** `2026-03` -> `Mar 2026` */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${y}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isValidMonth(m: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function parseAmountToSen(input: string): number | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
