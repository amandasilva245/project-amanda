import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Enum, DateTime, ForeignKey, Table
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class ScheduleType(str, enum.Enum):
    REHEARSAL = "rehearsal"
    PERFORMANCE = "performance"
    MEETING = "meeting"
    WORKSHOP = "workshop"
    TECH_RUN = "tech_run"
    DRESS_REHEARSAL = "dress_rehearsal"


# Association table for schedule participants
schedule_participants = Table(
    "schedule_participants",
    Base.metadata,
    Column("schedule_id", String(36), ForeignKey("schedules.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    production_id = Column(String(36), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    type = Column(Enum(ScheduleType), nullable=False, default=ScheduleType.REHEARSAL)
    description = Column(Text, nullable=True)

    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)

    location = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    is_cancelled = Column(String(1), default="N")

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    production = relationship("Production", back_populates="schedules")
    participants = relationship("User", secondary=schedule_participants)


class ScheduleParticipant(Base):
    """Extended participation with attendance tracking."""
    __tablename__ = "schedule_participant_details"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    schedule_id = Column(String(36), ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    status = Column(String(20), default="invited")  # invited, confirmed, absent
    notes = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="schedule_entries")
