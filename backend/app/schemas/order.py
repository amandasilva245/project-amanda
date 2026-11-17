from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.order import OrderStatus
from app.models.ticket import TicketStatus


class PublicSalesStatus(BaseModel):
    enabled: bool
    sandbox: bool
    reason: Optional[str] = None
    hold_minutes: int


class PublicEvent(BaseModel):
    batch_id: str
    production_id: str
    title: str
    subtitle: Optional[str] = None
    synopsis: Optional[str] = None
    playwright: Optional[str] = None
    venue: Optional[str] = None
    poster_url: Optional[str] = None
    color_accent: Optional[str] = None
    performance_date: datetime
    venue_section: Optional[str] = None
    price: Decimal
    price_premium: Optional[Decimal] = None
    available_seats: int
    sold_out: bool


class OrderCreate(BaseModel):
    batch_id: str = Field(min_length=1, max_length=36)
    buyer_name: str = Field(min_length=3, max_length=255)
    buyer_email: EmailStr
    buyer_phone: Optional[str] = Field(default=None, max_length=30)
    quantity: int = Field(default=1, ge=1, le=10)
    is_premium: bool = False
    # Consentimento LGPD: dados usados só para emitir e validar o ingresso
    accept_terms: bool

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("É preciso aceitar o uso dos dados para emitir o ingresso.")
        return v


class OrderCreated(BaseModel):
    order_id: str
    token: str
    checkout_url: str
    expires_at: datetime
    total_amount: Decimal


class OrderTicket(BaseModel):
    code: str
    is_premium: bool
    status: TicketStatus


class OrderView(BaseModel):
    id: str
    status: OrderStatus
    quantity: int
    is_premium: bool
    unit_price: Decimal
    total_amount: Decimal
    expires_at: datetime
    paid_at: Optional[datetime] = None
    created_at: datetime
    buyer_name: str
    buyer_email: str
    production_title: str
    performance_date: datetime
    venue: Optional[str] = None
    venue_section: Optional[str] = None
    checkout_url: Optional[str] = None
    tickets: List[OrderTicket] = []


class OrderRefresh(BaseModel):
    token: str = Field(min_length=10, max_length=64)


class OrderAdmin(BaseModel):
    id: str
    batch_id: str
    status: OrderStatus
    buyer_name: str
    buyer_email: str
    quantity: int
    total_amount: Decimal
    provider_payment_id: Optional[str] = None
    provider_status: Optional[str] = None
    expires_at: datetime
    paid_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
