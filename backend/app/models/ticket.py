import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Enum, DateTime, Date,
    Integer, Numeric, ForeignKey, Boolean, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class TicketBatchStatus(str, enum.Enum):
    ON_SALE = "on_sale"
    SOLD_OUT = "sold_out"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class TicketStatus(str, enum.Enum):
    RESERVED = "reserved"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    USED = "used"


class TicketBatch(Base):
    __tablename__ = "ticket_batches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    production_id = Column(String(36), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True)

    performance_date = Column(DateTime(timezone=True), nullable=False)
    venue_section = Column(String(100), nullable=True)
    description = Column(String(255), nullable=True)

    total_seats = Column(Integer, nullable=False)
    price = Column(Numeric(8, 2), nullable=False)
    price_premium = Column(Numeric(8, 2), nullable=True)

    tickets_sold = Column(Integer, default=0, nullable=False)
    status = Column(Enum(TicketBatchStatus), nullable=False, default=TicketBatchStatus.ON_SALE)

    sale_start = Column(DateTime(timezone=True), nullable=True)
    sale_end = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    production = relationship("Production", back_populates="ticket_batches")
    tickets = relationship("Ticket", back_populates="batch", cascade="all, delete-orphan")

    @property
    def available_seats(self):
        return self.total_seats - self.tickets_sold

    @property
    def revenue(self):
        return float(self.price) * self.tickets_sold


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    batch_id = Column(String(36), ForeignKey("ticket_batches.id", ondelete="CASCADE"), nullable=False, index=True)

    code = Column(String(20), unique=True, nullable=False, index=True)
    buyer_name = Column(String(255), nullable=False)
    buyer_email = Column(String(255), nullable=False)
    buyer_phone = Column(String(30), nullable=True)
    seat_number = Column(String(20), nullable=True)

    price_paid = Column(Numeric(8, 2), nullable=False)
    status = Column(Enum(TicketStatus), nullable=False, default=TicketStatus.CONFIRMED)

    purchase_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    used_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    batch = relationship("TicketBatch", back_populates="tickets")
