import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Enum, DateTime, Date,
    Numeric, ForeignKey, Boolean
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"


class TransactionCategory(str, enum.Enum):
    # Income
    TICKET_SALES = "ticket_sales"
    SPONSORSHIP = "sponsorship"
    GRANT = "grant"
    DONATION = "donation"
    MERCHANDISE = "merchandise"
    # Expense
    PERSONNEL = "personnel"
    VENUE = "venue"
    MARKETING = "marketing"
    COSTUMES = "costumes"
    SETS = "sets"
    EQUIPMENT = "equipment"
    ADMINISTRATION = "administration"
    OTHER = "other"


class FinancialTransaction(Base):
    __tablename__ = "financial_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    production_id = Column(String(36), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    type = Column(Enum(TransactionType), nullable=False)
    category = Column(Enum(TransactionCategory), nullable=False)

    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String(500), nullable=False)
    reference_code = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    date = Column(Date, nullable=False)
    is_reconciled = Column(Boolean, default=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    production = relationship("Production", back_populates="transactions")
    created_by = relationship("User", back_populates="transactions")
