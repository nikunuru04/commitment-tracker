from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..db import get_db
from ..models import Category, Transaction
from ..routers.commitments import txn_out
from ..schemas import ExpenseCreate, TransactionOut, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["transactions"], dependencies=[Depends(require_auth)])


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    type: str | None = None,
    month: str | None = None,
    category_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = select(Transaction).order_by(Transaction.txn_date.desc(), Transaction.id.desc())
    if type is not None:
        q = q.where(Transaction.type == type)
    if month is not None:
        q = q.where(Transaction.txn_date >= f"{month}-01", Transaction.txn_date <= f"{month}-31")
    if category_id is not None:
        q = q.where(Transaction.category_id == category_id)
    return [txn_out(t) for t in db.scalars(q).all()]


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(body: ExpenseCreate, db: Session = Depends(get_db)):
    if body.type == "payment":
        raise HTTPException(
            status_code=400, detail="Payments are only created via /api/commitments/{id}/pay"
        )
    if body.category_id is not None and not db.get(Category, body.category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    txn = Transaction(
        type="expense",
        amount_sen=body.amount_sen,
        txn_date=body.txn_date,
        description=body.description,
        category_id=body.category_id,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn_out(txn)


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(transaction_id: int, body: TransactionUpdate, db: Session = Depends(get_db)):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    data = body.model_dump(exclude_unset=True)
    if txn.type == "payment":
        allowed = {"description"}
        data = {k: v for k, v in data.items() if k in allowed}
    if data.get("category_id") is not None and not db.get(Category, data["category_id"]):
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in data.items():
        setattr(txn, field, value)
    db.commit()
    db.refresh(txn)
    return txn_out(txn)


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()
