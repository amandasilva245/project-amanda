from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.production import ProductionStatus, ProductionGenre, Department
from app.schemas.ticket import TicketBatchResponse
from app.schemas.user import UserSummary


def _check_period(start, end, label="data final"):
    if start and end and end < start:
        raise ValueError(f"A {label} não pode ser anterior à data inicial.")


class ParticipantCreate(BaseModel):
    user_id: str
    role_title: str = Field(min_length=1, max_length=255)
    department: Department
    character_name: Optional[str] = None
    fee: Optional[Decimal] = Field(default=None, ge=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    is_lead: bool = False
    is_confirmed: bool = False

    @model_validator(mode="after")
    def _period(self):
        _check_period(self.start_date, self.end_date)
        return self


class ParticipantUpdate(BaseModel):
    role_title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    department: Optional[Department] = None
    character_name: Optional[str] = None
    fee: Optional[Decimal] = Field(default=None, ge=0)
    fee_paid: Optional[Decimal] = Field(default=None, ge=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
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
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    is_lead: bool
    is_confirmed: bool

    model_config = {"from_attributes": True}


class CompanyRef(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}


class ProductionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    subtitle: Optional[str] = None
    synopsis: Optional[str] = None
    playwright: Optional[str] = None
    genre: Optional[ProductionGenre] = None
    status: ProductionStatus = ProductionStatus.DEVELOPMENT
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    first_performance_date: Optional[date] = None
    venue: Optional[str] = None
    venue_capacity: Optional[int] = Field(default=None, gt=0)
    budget_total: Optional[Decimal] = Field(default=None, ge=0)
    color_accent: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    # Aparece na página pública de ingressos (fase 8)
    is_public: bool = False
    duration_minutes: Optional[int] = Field(default=None, gt=0, le=1440)
    company_id: Optional[str] = None

    @model_validator(mode="after")
    def _period(self):
        _check_period(self.start_date, self.end_date, "data de encerramento")
        return self


class ProductionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1)
    subtitle: Optional[str] = None
    synopsis: Optional[str] = None
    playwright: Optional[str] = None
    genre: Optional[ProductionGenre] = None
    status: Optional[ProductionStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    first_performance_date: Optional[date] = None
    venue: Optional[str] = None
    venue_capacity: Optional[int] = Field(default=None, gt=0)
    budget_total: Optional[Decimal] = Field(default=None, ge=0)
    poster_url: Optional[str] = None
    color_accent: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    is_public: Optional[bool] = None
    duration_minutes: Optional[int] = Field(default=None, gt=0, le=1440)
    company_id: Optional[str] = None


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
    is_public: bool = False
    duration_minutes: Optional[int] = None
    company_id: Optional[str] = None
    company: Optional[CompanyRef] = None
    created_by: UserSummary
    created_at: datetime
    updated_at: datetime
    ticket_batches: List[TicketBatchResponse] = []

    model_config = {"from_attributes": True}


class ProductionDetailResponse(ProductionResponse):
    participants: List[ParticipantResponse] = []

    model_config = {"from_attributes": True}
