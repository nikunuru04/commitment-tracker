import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def validate_month(month: str) -> str:
    if not MONTH_RE.match(month):
        raise ValueError("month must be YYYY-MM")
    return month


class MonthQuery(BaseModel):
    month: str

    @field_validator("month")
    @classmethod
    def _v(cls, v):
        return validate_month(v)


# --- categories ---
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1)
    icon: str = "tag"


class CategoryUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None


class CategoryOut(BaseModel):
    id: int
    name: str
    icon: str
    is_default: int
    model_config = {"from_attributes": True}


# --- incomes ---
class IncomeCreate(BaseModel):
    source_name: str = Field(min_length=1)
    amount_sen: int = Field(gt=0)
    income_date: date
    description: str | None = None


class IncomeUpdate(BaseModel):
    source_name: str | None = None
    amount_sen: int | None = Field(default=None, gt=0)
    income_date: date | None = None
    description: str | None = None


class IncomeOut(BaseModel):
    id: int
    source_name: str
    amount_sen: int
    income_date: date
    description: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    model_config = {"from_attributes": True}


# --- commitments ---
class CommitmentCreate(BaseModel):
    name: str = Field(min_length=1)
    category_id: int
    amount_sen: int = Field(gt=0)
    frequency: Literal["weekly", "monthly", "yearly", "one_time"]
    start_date: date
    due_date: date | None = None
    notes: str | None = None


class CommitmentUpdate(BaseModel):
    name: str | None = None
    category_id: int | None = None
    amount_sen: int | None = Field(default=None, gt=0)
    frequency: Literal["weekly", "monthly", "yearly", "one_time"] | None = None
    start_date: date | None = None
    due_date: date | None = None
    notes: str | None = None
    archived: bool | None = None


class CommitmentOut(BaseModel):
    id: int
    name: str
    category_id: int
    category_name: str
    amount_sen: int
    frequency: str
    start_date: date
    due_date: date | None
    notes: str | None
    archived: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


# --- transactions ---
class PayRequest(BaseModel):
    occurrence_date: date


class ExpenseCreate(BaseModel):
    type: Literal["payment", "expense"]
    amount_sen: int = Field(gt=0)
    txn_date: date
    description: str | None = None
    category_id: int | None = None


class TransactionUpdate(BaseModel):
    amount_sen: int | None = Field(default=None, gt=0)
    txn_date: date | None = None
    description: str | None = None
    category_id: int | None = None


class TransactionOut(BaseModel):
    id: int
    type: str
    amount_sen: int
    txn_date: date
    description: str | None
    category_id: int | None
    category_name: str | None
    commitment_id: int | None
    commitment_name: str | None
    occurrence_date: date | None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# --- savings ---
class GoalCreate(BaseModel):
    name: str = Field(min_length=1)
    target_sen: int | None = Field(default=None, gt=0)
    target_date: date | None = None
    notes: str | None = None


class GoalUpdate(BaseModel):
    name: str | None = None
    target_sen: int | None = Field(default=None, gt=0)
    target_date: date | None = None
    notes: str | None = None
    archived: bool | None = None


class GoalOut(BaseModel):
    id: int
    name: str
    target_sen: int | None
    target_date: date | None
    notes: str | None
    archived: int
    allocated_total_sen: int


class AllocationCreate(BaseModel):
    goal_id: int
    amount_sen: int = Field(gt=0)
    allocation_date: date
    note: str | None = None


class AllocationUpdate(BaseModel):
    amount_sen: int | None = Field(default=None, gt=0)
    allocation_date: date | None = None
    note: str | None = None
    goal_id: int | None = None


class AllocationOut(BaseModel):
    id: int
    goal_id: int
    goal_name: str
    amount_sen: int
    allocation_date: date
    note: str | None
    model_config = {"from_attributes": True}


# --- summary/reports ---
class OccurrenceOut(BaseModel):
    commitment_id: int
    commitment_name: str
    category_name: str
    category_icon: str
    amount_sen: int
    occurrence_date: date
    status: str
    payment_id: int | None = None


class CategoryBreakdownItem(BaseModel):
    category_name: str
    icon: str
    amount_sen: int


class SavingsByGoalItem(BaseModel):
    goal_id: int
    goal_name: str
    allocated_this_month_sen: int
    allocated_total_sen: int
    target_sen: int | None
    target_date: date | None


class SummaryOut(BaseModel):
    month: str
    total_income_sen: int
    total_commitments_sen: int
    total_savings_sen: int
    available_sen: int
    income_count: int
    category_breakdown: list[CategoryBreakdownItem]
    savings_by_goal: list[SavingsByGoalItem]
    upcoming: list[OccurrenceOut]
    recent_transactions: list[TransactionOut]


class MonthlyReportOut(SummaryOut):
    prev_month: str
    prev_total_income_sen: int
    prev_total_commitments_sen: int
    prev_total_savings_sen: int
    prev_available_sen: int
    paid_sen: int
    planned_sen: int
    payment_count: int


class HistoryItem(BaseModel):
    month: str
    income_sen: int
    commitments_sen: int
    savings_sen: int
    available_sen: int


# --- auth ---
class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str


class AuthStatus(BaseModel):
    auth_required: bool
