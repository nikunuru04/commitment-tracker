from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..db import get_db
from ..models import SavingsAllocation, SavingsGoal
from ..schemas import (
    AllocationCreate,
    AllocationOut,
    AllocationUpdate,
    GoalCreate,
    GoalOut,
    GoalUpdate,
)

goals_router = APIRouter(
    prefix="/api/savings/goals", tags=["savings"], dependencies=[Depends(require_auth)]
)
allocations_router = APIRouter(
    prefix="/api/savings/allocations", tags=["savings"], dependencies=[Depends(require_auth)]
)


def _total(db: Session, goal_id: int) -> int:
    return db.scalar(
        select(func.coalesce(func.sum(SavingsAllocation.amount_sen), 0)).where(
            SavingsAllocation.goal_id == goal_id
        )
    )


def _goal_out(db: Session, g: SavingsGoal) -> GoalOut:
    return GoalOut(
        id=g.id,
        name=g.name,
        target_sen=g.target_sen,
        target_date=g.target_date,
        notes=g.notes,
        archived=g.archived,
        allocated_total_sen=_total(db, g.id),
    )


@goals_router.get("", response_model=list[GoalOut])
def list_goals(db: Session = Depends(get_db)):
    return [_goal_out(db, g) for g in db.scalars(select(SavingsGoal).order_by(SavingsGoal.id)).all()]


@goals_router.post("", response_model=GoalOut, status_code=201)
def create_goal(body: GoalCreate, db: Session = Depends(get_db)):
    g = SavingsGoal(**body.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return _goal_out(db, g)


@goals_router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, body: GoalUpdate, db: Session = Depends(get_db)):
    g = db.get(SavingsGoal, goal_id)
    if not g:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    data = body.model_dump(exclude_unset=True)
    if "archived" in data and data["archived"] is not None:
        data["archived"] = int(data["archived"])
    for field, value in data.items():
        setattr(g, field, value)
    db.commit()
    db.refresh(g)
    return _goal_out(db, g)


@goals_router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    g = db.get(SavingsGoal, goal_id)
    if not g:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    if db.scalar(
        select(SavingsAllocation.id).where(SavingsAllocation.goal_id == goal_id).limit(1)
    ):
        raise HTTPException(status_code=409, detail="Goal has allocations")
    db.delete(g)
    db.commit()


@allocations_router.get("", response_model=list[AllocationOut])
def list_allocations(
    month: str | None = None, goal_id: int | None = None, db: Session = Depends(get_db)
):
    q = select(SavingsAllocation).order_by(SavingsAllocation.allocation_date.desc(), SavingsAllocation.id.desc())
    if month is not None:
        q = q.where(
            SavingsAllocation.allocation_date >= f"{month}-01",
            SavingsAllocation.allocation_date <= f"{month}-31",
        )
    if goal_id is not None:
        q = q.where(SavingsAllocation.goal_id == goal_id)
    return db.scalars(q).all()


@allocations_router.post("", response_model=AllocationOut, status_code=201)
def create_allocation(body: AllocationCreate, db: Session = Depends(get_db)):
    if not db.get(SavingsGoal, body.goal_id):
        raise HTTPException(status_code=404, detail="Savings goal not found")
    a = SavingsAllocation(**body.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@allocations_router.patch("/{allocation_id}", response_model=AllocationOut)
def update_allocation(allocation_id: int, body: AllocationUpdate, db: Session = Depends(get_db)):
    a = db.get(SavingsAllocation, allocation_id)
    if not a:
        raise HTTPException(status_code=404, detail="Allocation not found")
    data = body.model_dump(exclude_unset=True)
    if data.get("goal_id") is not None and not db.get(SavingsGoal, data["goal_id"]):
        raise HTTPException(status_code=404, detail="Savings goal not found")
    for field, value in data.items():
        setattr(a, field, value)
    db.commit()
    db.refresh(a)
    return a


@allocations_router.delete("/{allocation_id}", status_code=204)
def delete_allocation(allocation_id: int, db: Session = Depends(get_db)):
    a = db.get(SavingsAllocation, allocation_id)
    if not a:
        raise HTTPException(status_code=404, detail="Allocation not found")
    db.delete(a)
    db.commit()
