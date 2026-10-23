from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..db import get_db
from ..models import Income
from ..schemas import IncomeCreate, IncomeOut, IncomeUpdate

router = APIRouter(prefix="/api/incomes", tags=["incomes"], dependencies=[Depends(require_auth)])


@router.get("", response_model=list[IncomeOut])
def list_incomes(month: str | None = None, db: Session = Depends(get_db)):
    q = select(Income).order_by(Income.income_date.desc(), Income.id.desc())
    if month is not None:
        q = q.where(Income.income_date >= f"{month}-01", Income.income_date <= f"{month}-31")
    return db.scalars(q).all()


@router.post("", response_model=IncomeOut, status_code=201)
def create_income(body: IncomeCreate, db: Session = Depends(get_db)):
    income = Income(**body.model_dump())
    db.add(income)
    db.commit()
    db.refresh(income)
    return income


@router.patch("/{income_id}", response_model=IncomeOut)
def update_income(income_id: int, body: IncomeUpdate, db: Session = Depends(get_db)):
    income = db.get(Income, income_id)
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(income, field, value)
    db.commit()
    db.refresh(income)
    return income


@router.delete("/{income_id}", status_code=204)
def delete_income(income_id: int, db: Session = Depends(get_db)):
    income = db.get(Income, income_id)
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")
    db.delete(income)
    db.commit()
