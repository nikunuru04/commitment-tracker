from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _timestamps():
    return (
        mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False),
        mapped_column(
            DateTime,
            server_default=func.current_timestamp(),
            onupdate=func.current_timestamp(),
            nullable=False,
        ),
    )


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    icon: Mapped[str] = mapped_column(String, nullable=False, default="tag")
    is_default: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = _timestamps()[0]
    updated_at: Mapped[datetime] = _timestamps()[1]


class Income(Base):
    __tablename__ = "incomes"
    __table_args__ = (Index("ix_incomes_income_date", "income_date"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    amount_sen: Mapped[int] = mapped_column(Integer, CheckConstraint("amount_sen>0"), nullable=False)
    income_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _timestamps()[0]
    updated_at: Mapped[datetime] = _timestamps()[1]


class Commitment(Base):
    __tablename__ = "commitments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id"), nullable=False
    )
    amount_sen: Mapped[int] = mapped_column(Integer, CheckConstraint("amount_sen>0"), nullable=False)
    frequency: Mapped[str] = mapped_column(
        String,
        CheckConstraint("frequency IN ('weekly','monthly','yearly','one_time')"),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = _timestamps()[0]
    updated_at: Mapped[datetime] = _timestamps()[1]

    category: Mapped[Category] = relationship(lazy="joined")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("commitment_id", "occurrence_date", name="uq_txn_occurrence"),
        Index("ix_transactions_txn_date", "txn_date"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(
        String, CheckConstraint("type IN ('payment','expense')"), nullable=False
    )
    amount_sen: Mapped[int] = mapped_column(Integer, CheckConstraint("amount_sen>0"), nullable=False)
    txn_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("categories.id"), nullable=True
    )
    commitment_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("commitments.id"), nullable=True
    )
    occurrence_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = _timestamps()[0]
    updated_at: Mapped[datetime] = _timestamps()[1]

    category: Mapped[Category | None] = relationship(lazy="joined")
    commitment: Mapped[Commitment | None] = relationship(lazy="joined")


class SavingsGoal(Base):
    __tablename__ = "savings_goals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    target_sen: Mapped[int | None] = mapped_column(Integer, CheckConstraint("target_sen>0"), nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = _timestamps()[0]
    updated_at: Mapped[datetime] = _timestamps()[1]


class SavingsAllocation(Base):
    __tablename__ = "savings_allocations"
    __table_args__ = (Index("ix_allocations_allocation_date", "allocation_date"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    goal_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("savings_goals.id"), nullable=False
    )
    amount_sen: Mapped[int] = mapped_column(Integer, CheckConstraint("amount_sen>0"), nullable=False)
    allocation_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _timestamps()[0]
    updated_at: Mapped[datetime] = _timestamps()[1]

    goal: Mapped[SavingsGoal] = relationship(lazy="joined")

    @property
    def goal_name(self) -> str:
        return self.goal.name


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


DEFAULT_CATEGORIES = [
    ("Loan", "Wallet"),
    ("Education", "GraduationCap"),
    ("House", "Home"),
    ("Car", "Car"),
    ("Petrol", "Fuel"),
    ("Self Therapy", "Heart"),
    ("Food", "Utensils"),
    ("Emergency Savings", "PiggyBank"),
    ("Maintenance", "Wrench"),
    ("Groceries", "ShoppingCart"),
    ("Other", "Tag"),
]
