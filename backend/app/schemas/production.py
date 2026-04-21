from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, field_validator

from app.models.production import ProductionStatus, ProductionGenre, Department
from app.schemas.ticket import TicketBatchResponse
from app.schemas.user import UserSummary


class ParticipantCreate(BaseModel):
    user_id: str
    role_title: str
    department: Department
    character_name: Optional[str] = None
    fee: Optional[Decimal] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    is_lead: bool = False


class ParticipantUpdate(BaseModel):
    role_title: Optional[str] = None
    department: Optional[Department] = None
    character_name: Optional[str] = None
    fee: Optional[Decimal] = None
    fee_paid: Optional[Decimal] = None
    is_lead: Optional[bool] = None
    is_confirmed: Optional[bool] = None
    notes: Optional[str] = None


class ParticipantResponse(BaseModel):
    id: str
    user: UserSummary
    role_title: str
    department: Department
    character_name: Optional[str] = None
    fee: Optional[Decimal] = None
    fee_paid: Optional[Decimal] = None
    is_lead: bool
    is_confirmed: bool

    model_config = {"from_attributes": True}


class ProductionCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    synopsis: Optional[str] = None
    playwright: Optional[str] = None
    genre: Optional[ProductionGenre] = None
    status: ProductionStatus = ProductionStatus.DEVELOPMENT
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    first_performance_date: Optional[date] = None
    venue: Optional[str] = None
    venue_capacity: Optional[int] = None
    budget_total: Optional[Decimal] = None
    color_accent: Optional[str] = None


class ProductionUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    synopsis: Optional[str] = None
    playwright: Optional[str] = None
    genre: Optional[ProductionGenre] = None
    status: Optional[ProductionStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    first_performance_date: Optional[date] = None
    venue: Optional[str] = None
    venue_capacity: Optional[int] = None
    budget_total: Optional[Decimal] = None
    poster_url: Optional[str] = None
    color_accent: Optional[str] = None


class ProductionResponse(BaseModel):
    id: str
    title: str
    slug: str
    subtitle: Optional[str] = None
    synopsis: Optional[str] = None
    playwright: Optional[str] = None
    genre: Optional[ProductionGenre] = None
    status: ProductionStatus
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    first_performance_date: Optional[date] = None
    venue: Optional[str] = None
    venue_capacity: Optional[int] = None
    budget_total: Optional[Decimal] = None
    poster_url: Optional[str] = None
    color_accent: Optional[str] = None
    created_by: UserSummary
    created_at: datetime
    updated_at: datetime
    ticket_batches: List[TicketBatchResponse] = []

    model_config = {"from_attributes": True}


class ProductionDetailResponse(ProductionResponse):
    participants: List[ParticipantResponse] = []

    model_config = {"from_attributes": True}
