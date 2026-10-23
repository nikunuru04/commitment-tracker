"""Pure calculation engine: occurrences + month totals. No DB imports."""
import calendar
from collections.abc import Iterable
from datetime import date

from .clock import today

FREQUENCIES = ("weekly", "monthly", "yearly", "one_time")


def month_window(month: str) -> tuple[date, date]:
    year, m = int(month[:4]), int(month[5:7])
    last = calendar.monthrange(year, m)[1]
    return date(year, m, 1), date(year, m, last)


def in_month(d: date, month: str) -> bool:
    return f"{d.year:04d}-{d.month:02d}" == month


def _add_months(d: date, n: int, clamp: bool = False) -> date:
    y, m = d.year + (d.month - 1 + n) // 12, (d.month - 1 + n) % 12 + 1
    day = d.day
    if clamp:
        day = min(day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


def occurrences(freq: str, start: date, end: date | None = None) -> list[date]:
    """All occurrence dates of a commitment from start (inclusive) up to end (inclusive)."""
    if freq == "one_time":
        return [start] if (end is None or start <= end) else []
    if freq == "weekly":
        out, cur = [], start
        while end is None or cur <= end:
            out.append(cur)
            cur = date.fromordinal(cur.toordinal() + 7)
        return out
    if freq == "monthly":
        out, k = [], 0
        while True:
            cur = _add_months(start, k, clamp=True)
            if end is not None and cur > end:
                break
            out.append(cur)
            k += 1
        return out
    if freq == "yearly":
        out = []
        y = start.year
        while True:
            cur = _add_months(start, 12 * (y - start.year), clamp=True)
            if end is not None and cur > end:
                break
            out.append(cur)
            y += 1
        return out
    raise ValueError(f"unknown frequency: {freq}")


def month_occurrences(freq: str, start: date, month: str) -> list[date]:
    """Occurrences of a commitment falling within month M."""
    first, last = month_window(month)
    if freq == "one_time":
        return [start] if first <= start <= last else []
    if freq == "weekly":
        out, cur = [], start
        while cur <= last:
            if cur >= first:
                out.append(cur)
            cur = date.fromordinal(cur.toordinal() + 7)
        return out
    # monthly / yearly: jump near target month, respect clamping
    if start > last:
        return []
    first_of_start_month = date(start.year, start.month, 1)
    if freq == "monthly":
        k = (first.year - start.year) * 12 + (first.month - start.month)
        cur = _add_months(start, k, clamp=True)
    else:  # yearly
        k = first.year - start.year
        cur = _add_months(start, 12 * k, clamp=True)
        if cur < first:
            k += 1
            cur = _add_months(start, 12 * k, clamp=True)
    out = []
    while cur <= last:
        if cur >= first:
            out.append(cur)
        if freq == "monthly":
            k += 1
            cur = _add_months(start, k, clamp=True)
        else:
            break
    return out


def commitment_alloc_sen(
    commitments: Iterable, month: str
) -> int:
    """Sum amount_sen × |occurrences ∩ M| over non-archived commitments.

    Rows need: amount_sen, frequency, start_date, archived (or is_archived()).
    """
    total = 0
    for c in commitments:
        if getattr(c, "archived", 0):
            continue
        n = len(month_occurrences(c.frequency, c.start_date, month))
        total += c.amount_sen * n
    return total


def total_income_sen(incomes: Iterable, month: str) -> int:
    return sum(i.amount_sen for i in incomes if in_month(i.income_date, month))


def total_savings_sen(allocations: Iterable, month: str) -> int:
    return sum(a.amount_sen for a in allocations if in_month(a.allocation_date, month))


def available_sen(income_sen: int, commitments_sen: int, savings_sen: int) -> int:
    return income_sen - commitments_sen - savings_sen


def payment_status(occurrence: date, paid: bool) -> str:
    if paid:
        return "paid"
    if occurrence < today():
        return "overdue"
    return "pending"


def is_overdue(occurrence: date, paid: bool) -> bool:
    return not paid and occurrence < today()
