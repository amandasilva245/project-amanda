from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr

from app.models.ticket import TicketBatchStatus, TicketStatus


class TicketBatchCreate(BaseModel):
    production_id: str
    performance_date: datetime
    venue_section: Optional[str] = None
    description: Optional[str] = None
    total_seats: int
    price: Decimal
    price_premium: Optional[Decimal] = None
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None


class TicketBatchUpdate(BaseModel):
    description: Optional[str] = None
    total_seats: Optional[int] = None
    price: Optional[Decimal] = None
    price_premium: Optional[Decimal] = None
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
    status: TicketBatchStatus
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketCreate(BaseModel):
    batch_id: str
    buyer_name: str
    buyer_email: EmailStr
    buyer_phone: Optional[str] = None
    seat_number: Optional[str] = None
    price_paid: Decimal
    notes: Optional[str] = None


class TicketResponse(BaseModel):
    id: str
    batch_id: str
    code: str
    buyer_name: str
    buyer_email: str
    buyer_phone: Optional[str] = None
    seat_number: Optional[str] = None
    price_paid: Decimal
    status: TicketStatus
    purchase_date: datetime
    used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TicketSalesSummary(BaseModel):
    production_id: str
    total_batches: int
    total_seats: int
    total_sold: int
    total_revenue: Decimal
    occupancy_rate: float
    upcoming_performances: List[TicketBatchResponse]
