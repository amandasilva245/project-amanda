import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, String, Text, Enum, DateTime, ForeignKey, Table, UniqueConstraint, false,
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


class AttendanceStatus(str, enum.Enum):
    INVITED = "invited"
    CONFIRMED = "confirmed"
    ABSENT = "absent"


# Tabela legada (nunca usada pela API). Mantida no modelo para que o Alembic
# não a apague; a presença é registrada em `schedule_participant_details`.
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

    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)

    location = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    # Cancelamento lógico (RF17): o evento continua no histórico
    is_cancelled = Column(Boolean, nullable=False, default=False, server_default=false())
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(String(500), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    production = relationship("Production", back_populates="schedules")
    attendees = relationship(
        "ScheduleParticipant", back_populates="schedule", cascade="all, delete-orphan",
    )


class ScheduleParticipant(Base):
    """Participante convidado para um evento, com status de presença (RF16)."""
    __tablename__ = "schedule_participant_details"
    __table_args__ = (UniqueConstraint("schedule_id", "user_id", name="uq_schedule_attendee"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    schedule_id = Column(String(36), ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    status = Column(String(20), default=AttendanceStatus.INVITED.value, nullable=False)  # invited, confirmed, absent
    notes = Column(Text, nullable=True)

    # Relationships
    schedule = relationship("Schedule", back_populates="attendees")
    user = relationship("User", back_populates="schedule_entries")
