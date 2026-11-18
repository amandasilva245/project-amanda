"""Tarefas e atividades das produções (quem faz o quê e até quando)."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


def _now():
    return datetime.now(timezone.utc)


class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ProductionTask(Base):
    __tablename__ = "production_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    production_id = Column(String(36), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assignee_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    due_date = Column(Date, nullable=True)
    status = Column(Enum(TaskStatus, name="taskstatus"), nullable=False, default=TaskStatus.TODO, index=True)
    priority = Column(Enum(TaskPriority, name="taskpriority"), nullable=False, default=TaskPriority.MEDIUM)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    production = relationship("Production", back_populates="tasks")
    assignee = relationship("User")
