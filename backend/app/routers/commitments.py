from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..clock import today
from ..db import get_db
from ..engine import month_window, month_occurrences, payment_status
from ..models import Category, Commitment, Transaction
from ..schemas import (
    CommitmentCreate,
    CommitmentOut,
    CommitmentUpdate,
    OccurrenceOut,
    PayRequest,
    TransactionOut,
)

router = APIRouter(prefix="/api/commitments", tags=["commitments"], dependencies=[Depends(require_auth)])


def txn_out(t: Transaction) -> TransactionOut:
    return TransactionOut(
        id=t.id,
        type=t.type,
        amount_sen=t.amount_sen,
        txn_date=t.txn_date,
        description=t.description,
        category_id=t.category_id,
        category_name=t.category.name if t.category else None,
        commitment_id=t.commitment_id,
        commitment_name=t.commitment.name if t.commitment else None,
        occurrence_date=t.occurrence_date,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def _out(c: Commitment) -> CommitmentOut:
    return CommitmentOut(
        id=c.id,
        name=c.name,
        category_id=c.category_id,
        category_name=c.category.name,
        amount_sen=c.amount_sen,
        frequency=c.frequency,
        start_date=c.start_date,
        due_date=c.due_date,
        notes=c.notes,
        archived=c.archived,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get("", response_model=list[CommitmentOut])
def list_commitments(
    category_id: int | None = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
):
    q = select(Commitment)
    if category_id is not None:
        q = q.where(Commitment.category_id == category_id)
    if not include_archived:
        q = q.where(Commitment.archived == 0)
    q = q.order_by(Commitment.id)
    return [_out(c) for c in db.scalars(q).all()]


@router.post("", response_model=CommitmentOut, status_code=201)
def create_commitment(body: CommitmentCreate, db: Session = Depends(get_db)):
    if not db.get(Category, body.category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    c = Commitment(**body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.patch("/{commitment_id}", response_model=CommitmentOut)
def update_commitment(commitment_id: int, body: CommitmentUpdate, db: Session = Depends(get_db)):
    c = db.get(Commitment, commitment_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commitment not found")
    data = body.model_dump(exclude_unset=True)
    if data.get("category_id") is not None and not db.get(Category, data["category_id"]):
        raise HTTPException(status_code=404, detail="Category not found")
    if "archived" in data and data["archived"] is not None:
        data["archived"] = int(data["archived"])
    for field, value in data.items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.delete("/{commitment_id}", status_code=204)
def delete_commitment(commitment_id: int, db: Session = Depends(get_db)):
    c = db.get(Commitment, commitment_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commitment not found")
    has_history = db.scalar(
        select(Transaction.id)
        .where(Transaction.commitment_id == commitment_id, Transaction.type == "payment")
        .limit(1)
    )
    if has_history:
        raise HTTPException(
            status_code=409, detail="Commitment has payment history; archive it instead"
        )
    db.delete(c)
    db.commit()


def _paid_map(db: Session, commitment_ids: set[int], first: object, last: object) -> dict:
    if not commitment_ids:
        return {}
    rows = db.execute(
        select(Transaction.commitment_id, Transaction.occurrence_date, Transaction.id).where(
            Transaction.type == "payment",
            Transaction.commitment_id.in_(commitment_ids),
            Transaction.occurrence_date >= first,
            Transaction.occurrence_date <= last,
        )
    ).all()
    return {(r[0], r[1]): r[2] for r in rows}


@router.get("/occurrences", response_model=list[OccurrenceOut])
def list_occurrences(month: str | None = None, db: Session = Depends(get_db)):
    from ..schemas import validate_month

    if month is not None:
        validate_month(month)
    commitments = db.scalars(select(Commitment).where(Commitment.archived == 0)).all()
    payments = {
        (t.commitment_id, t.occurrence_date): t.id
        for t in db.scalars(select(Transaction).where(Transaction.type == "payment"))
    }
    items: list[OccurrenceOut] = []
    for c in commitments:
        occs = month_occurrences(c.frequency, c.start_date, month) if month else []
        for occ in occs:
            pid = payments.get((c.id, occ))
            items.append(
                OccurrenceOut(
                    commitment_id=c.id,
                    commitment_name=c.name,
                    category_name=c.category.name,
                    category_icon=c.category.icon,
                    amount_sen=c.amount_sen,
                    occurrence_date=occ,
                    status=payment_status(occ, pid is not None),
                    payment_id=pid,
                )
            )
    if month is not None:
        first, last = month_window(month)
        items = [
            i
            for i in items
            if (first <= i.occurrence_date <= last) or (i.status == "overdue")
        ]
    items.sort(key=lambda i: i.occurrence_date)
    return items


@router.post("/{commitment_id}/pay", response_model=TransactionOut, status_code=201)
def pay(commitment_id: int, body: PayRequest, db: Session = Depends(get_db)):
    c = db.get(Commitment, commitment_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commitment not found")
    occs = month_occurrences(c.frequency, c.start_date, body.occurrence_date.strftime("%Y-%m"))
    if body.occurrence_date not in occs:
        raise HTTPException(status_code=404, detail="Invalid occurrence date for commitment")
    existing = db.scalar(
        select(Transaction).where(
            Transaction.commitment_id == commitment_id,
            Transaction.occurrence_date == body.occurrence_date,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Occurrence already paid")
    txn = Transaction(
        type="payment",
        amount_sen=c.amount_sen,
        txn_date=today(),
        description=f"Payment: {c.name}",
        category_id=c.category_id,
        commitment_id=c.id,
        occurrence_date=body.occurrence_date,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn_out(txn)
