from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel

from app.models.financial import TransactionType, TransactionCategory
from app.schemas.user import UserSummary


class TransactionCreate(BaseModel):
    production_id: str
    type: TransactionType
    category: TransactionCategory
    amount: Decimal
    description: str
    reference_code: Optional[str] = None
    notes: Optional[str] = None
    date: date


class TransactionUpdate(BaseModel):
    category: Optional[TransactionCategory] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    reference_code: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[date] = None
    is_reconciled: Optional[bool] = None


class TransactionResponse(BaseModel):
    id: str
    production_id: str
    type: TransactionType
    category: TransactionCategory
    amount: Decimal
    description: str
    reference_code: Optional[str] = None
    notes: Optional[str] = None
    date: date
    is_reconciled: bool
    created_by: UserSummary
    created_at: datetime

    model_config = {"from_attributes": True}


class FinancialSummary(BaseModel):
    production_id: str
    total_income: Decimal
    total_expense: Decimal
    net_balance: Decimal
    budget_total: Optional[Decimal]
    budget_used_pct: Optional[float]
    income_by_category: dict
    expense_by_category: dict
