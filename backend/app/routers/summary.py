import calendar
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..clock import today
from ..db import get_db
from ..engine import (
    available_sen,
    commitment_alloc_sen,
    in_month,
    month_occurrences,
    month_window,
    payment_status,
)
from ..models import Commitment, Income, SavingsAllocation, SavingsGoal, Transaction
from ..routers.commitments import txn_out
from ..schemas import (
    CategoryBreakdownItem,
    HistoryItem,
    MonthlyReportOut,
    OccurrenceOut,
    SavingsByGoalItem,
    SummaryOut,
    TransactionOut,
    validate_month,
)

router = APIRouter(prefix="/api", tags=["summary"], dependencies=[Depends(require_auth)])


def _prev_month(month: str) -> str:
    year, m = int(month[:4]), int(month[5:7])
    y, m = (year - 1, 12) if m == 1 else (year, m - 1)
    return f"{y:04d}-{m:02d}"


def _next_month(month: str) -> str:
    year, m = int(month[:4]), int(month[5:7])
    y, m = (year + 1, 1) if m == 12 else (year, m + 1)
    return f"{y:04d}-{m:02d}"


def _month_totals(db: Session, month: str) -> dict:
    incomes = db.scalars(select(Income)).all()
    allocations = db.scalars(select(SavingsAllocation)).all()
    commitments = db.scalars(select(Commitment).where(Commitment.archived == 0)).all()
    income_sen = sum(i.amount_sen for i in incomes if in_month(i.income_date, month))
    commitments_sen = commitment_alloc_sen(commitments, month)
    savings_sen = sum(a.amount_sen for a in allocations if in_month(a.allocation_date, month))
    return {
        "total_income_sen": income_sen,
        "income_count": sum(1 for i in incomes if in_month(i.income_date, month)),
        "total_commitments_sen": commitments_sen,
        "total_savings_sen": savings_sen,
        "available_sen": available_sen(income_sen, commitments_sen, savings_sen),
    }


def _category_breakdown(db: Session, month: str) -> list[CategoryBreakdownItem]:
    commitments = db.scalars(select(Commitment).where(Commitment.archived == 0)).all()
    by_cat: dict[int, dict] = {}
    for c in commitments:
        n = len(month_occurrences(c.frequency, c.start_date, month))
        if n == 0:
            continue
        entry = by_cat.setdefault(c.category_id, {"cat": c.category, "amount_sen": 0})
        entry["amount_sen"] += c.amount_sen * n
    items = [
        CategoryBreakdownItem(
            category_name=e["cat"].name, icon=e["cat"].icon, amount_sen=e["amount_sen"]
        )
        for e in by_cat.values()
    ]
    items.sort(key=lambda i: i.amount_sen, reverse=True)
    return items


def _savings_by_goal(db: Session, month: str) -> list[SavingsByGoalItem]:
    goals = db.scalars(select(SavingsGoal)).all()
    out = []
    for g in goals:
        allocs = db.scalars(
            select(SavingsAllocation).where(SavingsAllocation.goal_id == g.id)
        ).all()
        total = sum(a.amount_sen for a in allocs)
        this_month = sum(a.amount_sen for a in allocs if in_month(a.allocation_date, month))
        out.append(
            SavingsByGoalItem(
                goal_id=g.id,
                goal_name=g.name,
                allocated_this_month_sen=this_month,
                allocated_total_sen=total,
                target_sen=g.target_sen,
                target_date=g.target_date,
            )
        )
    return out


def _upcoming(db: Session, month: str) -> list[OccurrenceOut]:
    commitments = db.scalars(select(Commitment).where(Commitment.archived == 0)).all()
    payments = {
        (t.commitment_id, t.occurrence_date)
        for t in db.scalars(select(Transaction).where(Transaction.type == "payment"))
    }
    t = today()
    from datetime import timedelta

    horizon = t + timedelta(days=14)
    items = []
    for c in commitments:
        # scan this month and next to cover today..+14d window
        for m in {month, _next_month(month)}:
            for occ in month_occurrences(c.frequency, c.start_date, m):
                if (c.id, occ) in payments:
                    continue
                if t <= occ <= horizon:
                    items.append(
                        OccurrenceOut(
                            commitment_id=c.id,
                            commitment_name=c.name,
                            category_name=c.category.name,
                            category_icon=c.category.icon,
                            amount_sen=c.amount_sen,
                            occurrence_date=occ,
                            status=payment_status(occ, False),
                        )
                    )
    items.sort(key=lambda i: i.occurrence_date)
    return items


def _recent_transactions(db: Session) -> list[TransactionOut]:
    txns = db.scalars(
        select(Transaction).order_by(Transaction.txn_date.desc(), Transaction.id.desc()).limit(8)
    ).all()
    return [txn_out(t) for t in txns]


def _summary(db: Session, month: str) -> SummaryOut:
    return SummaryOut(
        month=month,
        **_month_totals(db, month),
        category_breakdown=_category_breakdown(db, month),
        savings_by_goal=_savings_by_goal(db, month),
        upcoming=_upcoming(db, month),
        recent_transactions=_recent_transactions(db),
    )


def _parse_month(month: str | None) -> str:
    if month is None:
        return today().strftime("%Y-%m")
    try:
        return validate_month(month)
    except ValueError:
        raise HTTPException(status_code=422, detail="month must be YYYY-MM")


@router.get("/export")
def export(db: Session = Depends(get_db)):
    from ..models import Category, SavingsAllocation, SavingsGoal  # noqa: F401

    def dump(model):
        rows = db.scalars(select(model)).all()
        return [
            {
                c.key: (str(getattr(r, c.key)) if isinstance(getattr(r, c.key), (date, datetime)) else getattr(r, c.key))
                for c in model.__table__.columns
            }
            for r in rows
        ]

    payload = {
        "exported_at": datetime.now().isoformat(),
        "data": {
            "categories": dump(Category),
            "incomes": dump(Income),
            "commitments": dump(Commitment),
            "transactions": dump(Transaction),
            "savings_goals": dump(SavingsGoal),
            "savings_allocations": dump(SavingsAllocation),
        },
    }
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": 'attachment; filename="commitment-tracker-export.json"'},
    )


@router.get("/summary", response_model=SummaryOut)
def summary(month: str = Query(...), db: Session = Depends(get_db)):
    m = _parse_month(month)
    return _summary(db, m)


@router.get("/reports/monthly", response_model=MonthlyReportOut)
def report_monthly(month: str | None = None, db: Session = Depends(get_db)):
    m = _parse_month(month)
    prev = _prev_month(m)
    prev_totals = _month_totals(db, prev)
    paid = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount_sen), 0)).where(
            Transaction.type == "payment",
            Transaction.txn_date >= f"{m}-01",
            Transaction.txn_date <= f"{m}-31",
        )
    )
    payment_count = db.scalar(
        select(func.count(Transaction.id)).where(
            Transaction.type == "payment",
            Transaction.txn_date >= f"{m}-01",
            Transaction.txn_date <= f"{m}-31",
        )
    )
    return MonthlyReportOut(
        **_summary(db, m).model_dump(),
        prev_month=prev,
        prev_total_income_sen=prev_totals["total_income_sen"],
        prev_total_commitments_sen=prev_totals["total_commitments_sen"],
        prev_total_savings_sen=prev_totals["total_savings_sen"],
        prev_available_sen=prev_totals["available_sen"],
        paid_sen=paid,
        planned_sen=_month_totals(db, m)["total_commitments_sen"],
        payment_count=payment_count,
    )


@router.get("/reports/history", response_model=list[HistoryItem])
def report_history(month: str | None = None, months: int = Query(12, ge=1, le=120), db: Session = Depends(get_db)):
    end = _parse_month(month)
    end_y, end_m = int(end[:4]), int(end[5:7])
    out = []
    for back in range(months - 1, -1, -1):
        total = (end_m - 1 - back) % 12 + 1
        y = end_y + (end_m - 1 - back) // 12
        m = f"{y:04d}-{total:02d}"
        totals = _month_totals(db, m)
        out.append(
            HistoryItem(
                month=m,
                income_sen=totals["total_income_sen"],
                commitments_sen=totals["total_commitments_sen"],
                savings_sen=totals["total_savings_sen"],
                available_sen=totals["available_sen"],
            )
        )
    return out
