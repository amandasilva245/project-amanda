from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator

from app.models.schedule import AttendanceStatus, ScheduleType
from app.schemas.user import UserSummary


def _check_times(start, end):
    if start and end and end <= start:
        raise ValueError("O término deve ser depois do início.")
    if start and start.tzinfo is None:
        raise ValueError("Informe o horário com fuso (ISO 8601, ex.: 2026-05-10T19:00:00-03:00).")


class ScheduleCreate(BaseModel):
    production_id: str
    title: str = Field(min_length=1, max_length=255)
    type: ScheduleType = ScheduleType.REHEARSAL
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None
    attendee_ids: List[str] = []

    @model_validator(mode="after")
    def _times(self):
        _check_times(self.start_time, self.end_time)
        return self


class ScheduleUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    type: Optional[ScheduleType] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None
    attendee_ids: Optional[List[str]] = None


class ScheduleCancel(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus
    notes: Optional[str] = None


class AttendeeResponse(BaseModel):
    user: UserSummary
    status: AttendanceStatus
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class ProductionRef(BaseModel):
    id: str
    title: str
    color_accent: Optional[str] = None

    model_config = {"from_attributes": True}


class ScheduleResponse(BaseModel):
    id: str
    production_id: str
    production: ProductionRef
    title: str
    type: ScheduleType
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    notes: Optional[str] = None
    is_cancelled: bool
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None
    attendees: List[AttendeeResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ConflictItem(BaseModel):
    user_id: str
    user_name: str
    schedule_id: str
    schedule_title: str
    production_title: str
    start_time: datetime
    end_time: datetime
