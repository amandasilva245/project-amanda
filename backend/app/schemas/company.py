from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.company import ResourceStatus, ResourceType


def _blank_to_none(v):
    return None if isinstance(v, str) and not v.strip() else v


class CompanyBase(BaseModel):
    description: Optional[str] = Field(default=None, max_length=4000)
    responsible_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    city: Optional[str] = Field(default=None, max_length=120)
    founded_year: Optional[int] = Field(default=None, ge=1500, le=2100)
    website: Optional[str] = Field(default=None, max_length=255)

    _blank = field_validator("email", "website", "phone", "city", "responsible_name", "description",
                             mode="before")(_blank_to_none)


class CompanyCreate(CompanyBase):
    name: str = Field(min_length=2, max_length=255)


class CompanyUpdate(CompanyBase):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)


class CompanyResponse(CompanyBase):
    id: str
    name: str
    email: Optional[str] = None
    created_at: datetime
    production_count: int = 0

    model_config = {"from_attributes": True}


class UserRef(BaseModel):
    id: str
    full_name: str

    model_config = {"from_attributes": True}


class ResourceBase(BaseModel):
    type: Optional[ResourceType] = None
    status: Optional[ResourceStatus] = None
    quantity: Optional[int] = Field(default=None, ge=1, le=100000)
    unit_cost: Optional[Decimal] = Field(default=None, ge=0, le=Decimal("99999999.99"))
    supplier: Optional[str] = Field(default=None, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    responsible_id: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=4000)


class ResourceCreate(ResourceBase):
    production_id: str
    name: str = Field(min_length=2, max_length=255)
    type: ResourceType
    status: ResourceStatus = ResourceStatus.PLANNED
    quantity: int = Field(default=1, ge=1, le=100000)


class ResourceUpdate(ResourceBase):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)


class ResourceResponse(BaseModel):
    id: str
    production_id: str
    production_title: Optional[str] = None
    name: str
    type: ResourceType
    status: ResourceStatus
    quantity: int
    unit_cost: Optional[Decimal] = None
    total_cost: Decimal = Decimal("0")
    supplier: Optional[str] = None
    location: Optional[str] = None
    responsible: Optional[UserRef] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ResourceSummary(BaseModel):
    total_items: int
    total_cost: Decimal
    by_type: List[dict]


# ── Tarefas ──────────────────────────────────────────────────────────────────
from datetime import date  # noqa: E402

from app.models.task import TaskPriority, TaskStatus  # noqa: E402


class TaskCreate(BaseModel):
    production_id: str
    title: str = Field(min_length=2, max_length=255)
    description: Optional[str] = Field(default=None, max_length=4000)
    assignee_id: Optional[str] = None
    due_date: Optional[date] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = Field(default=None, max_length=4000)
    assignee_id: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None


class TaskResponse(BaseModel):
    id: str
    production_id: str
    production_title: Optional[str] = None
    title: str
    description: Optional[str] = None
    assignee: Optional[UserRef] = None
    due_date: Optional[date] = None
    status: TaskStatus
    priority: TaskPriority
    overdue: bool = False
    completed_at: Optional[datetime] = None
    created_at: datetime
