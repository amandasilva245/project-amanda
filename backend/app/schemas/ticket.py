from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.ticket import TicketBatchStatus, TicketStatus

MAX_PRICE = Decimal("999999.99")


def _check_sale_period(start, end):
    if start and end and end <= start:
        raise ValueError("O fim das vendas deve ser depois do início.")


class TicketBatchCreate(BaseModel):
    production_id: str
    performance_date: datetime
    venue_section: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    total_seats: int = Field(gt=0, le=100000)
    price: Decimal = Field(ge=0, le=MAX_PRICE)
    price_premium: Optional[Decimal] = Field(default=None, ge=0, le=MAX_PRICE)
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None

    @model_validator(mode="after")
    def _validate(self):
        if self.performance_date.tzinfo is None:
            raise ValueError("Informe a data da sessão com fuso horário (ISO 8601).")
        _check_sale_period(self.sale_start, self.sale_end)
        if self.sale_end and self.sale_end > self.performance_date:
            raise ValueError("As vendas não podem terminar depois da sessão.")
        return self


class TicketBatchUpdate(BaseModel):
    performance_date: Optional[datetime] = None
    venue_section: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    total_seats: Optional[int] = Field(default=None, gt=0, le=100000)
    price: Optional[Decimal] = Field(default=None, ge=0, le=MAX_PRICE)
    price_premium: Optional[Decimal] = Field(default=None, ge=0, le=MAX_PRICE)
    status: Optional[TicketBatchStatus] = None
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None


class TicketBatchResponse(BaseModel):
    id: str
    production_id: str
    performance_date: datetime
    venue_section: Optional[str] = None
    description: Optional[str] = None
    total_seats: int
    price: Decimal
    price_premium: Optional[Decimal] = None
    tickets_sold: int
    available_seats: int = 0
    status: TicketBatchStatus
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketCreate(BaseModel):
    batch_id: str
    buyer_name: str = Field(min_length=2, max_length=255)
    buyer_email: EmailStr
    buyer_phone: Optional[str] = Field(default=None, max_length=30)
    seat_number: Optional[str] = Field(default=None, max_length=20)
    is_premium: bool = False
    # Sem valor, usa o preço do lote (inteira ou premium)
    price_paid: Optional[Decimal] = Field(default=None, ge=0, le=MAX_PRICE)
    quantity: int = Field(default=1, ge=1, le=20)
    status: TicketStatus = TicketStatus.CONFIRMED
    notes: Optional[str] = None

    @model_validator(mode="after")
    def _status(self):
        if self.status not in (TicketStatus.CONFIRMED, TicketStatus.RESERVED):
            raise ValueError("Um ingresso novo só pode ser reservado ou confirmado.")
        if self.quantity > 1 and self.seat_number:
            raise ValueError("Informe o assento apenas para um ingresso por vez.")
        return self


class TicketResponse(BaseModel):
    id: str
    batch_id: str
    code: str
    buyer_name: str
    buyer_email: str
    buyer_phone: Optional[str] = None
    seat_number: Optional[str] = None
    price_paid: Decimal
    is_premium: bool = False
    status: TicketStatus
    purchase_date: datetime
    used_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class CheckInRequest(BaseModel):
    code: str = Field(min_length=4, max_length=20)


class CheckInResult(BaseModel):
    ticket: TicketResponse
    performance_date: datetime
    production_title: str


class TicketSalesSummary(BaseModel):
    production_id: str
    total_batches: int
    total_seats: int
    total_sold: int
    total_checked_in: int
    total_revenue: Decimal
    occupancy_rate: float
    upcoming_performances: List[TicketBatchResponse]
