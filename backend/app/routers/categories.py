from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..db import get_db
from ..models import Category, Commitment, Transaction
from ..schemas import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["categories"], dependencies=[Depends(require_auth)])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.id)).all()


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Category).where(Category.name == body.name)):
        raise HTTPException(status_code=409, detail="Category name already exists")
    cat = Category(name=body.name, icon=body.icon)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, body: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if body.name is not None and body.name != cat.name:
        if db.scalar(select(Category).where(Category.name == body.name)):
            raise HTTPException(status_code=409, detail="Category name already exists")
        cat.name = body.name
    if body.icon is not None:
        cat.icon = body.icon
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    in_use = db.scalar(
        select(Commitment.id).where(Commitment.category_id == category_id).limit(1)
    ) or db.scalar(select(Transaction.id).where(Transaction.category_id == category_id).limit(1))
    if in_use:
        raise HTTPException(status_code=409, detail="Category is in use")
    db.delete(cat)
    db.commit()
