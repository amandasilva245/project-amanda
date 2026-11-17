from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, model_validator

from app.models.financial import TransactionType, TransactionCategory
from app.schemas.user import UserSummary

C = TransactionCategory
INCOME_CATEGORIES = {C.TICKET_SALES, C.SPONSORSHIP, C.GRANT, C.DONATION, C.MERCHANDISE, C.OTHER}
EXPENSE_CATEGORIES = {C.PERSONNEL, C.VENUE, C.MARKETING, C.COSTUMES, C.SETS, C.EQUIPMENT, C.ADMINISTRATION, C.OTHER}


def check_category(type_: TransactionType, category: TransactionCategory) -> None:
    allowed = INCOME_CATEGORIES if type_ == TransactionType.INCOME else EXPENSE_CATEGORIES
    if category not in allowed:
        kind = "receita" if type_ == TransactionType.INCOME else "despesa"
        raise ValueError(f"A categoria '{category.value}' não é válida para {kind}.")


class ProductionRef(BaseModel):
    id: str
    title: str

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    production_id: str
    type: TransactionType
    category: TransactionCategory
    amount: Decimal = Field(gt=0, le=Decimal("9999999999.99"))
    description: str = Field(min_length=1, max_length=500)
    reference_code: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None
    date: date
    is_reconciled: bool = False

    @model_validator(mode="after")
    def _category(self):
        check_category(self.type, self.category)
        return self


class TransactionUpdate(BaseModel):
    category: Optional[TransactionCategory] = None
    amount: Optional[Decimal] = Field(default=None, gt=0, le=Decimal("9999999999.99"))
    description: Optional[str] = Field(default=None, min_length=1, max_length=500)
    reference_code: Optional[str] = Field(default=None, max_length=100)
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
    production: Optional[ProductionRef] = None
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
