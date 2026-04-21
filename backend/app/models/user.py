import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, Enum, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PRODUCER = "producer"
    FINANCIAL_MANAGER = "financial_manager"
    DIRECTOR = "director"
    TECHNICIAN = "technician"
    ACTOR = "actor"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.ACTOR)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    phone = Column(String(30), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    participations = relationship("ProductionParticipant", back_populates="user", lazy="dynamic")
    created_productions = relationship(
        "Production", back_populates="created_by", foreign_keys="Production.created_by_id"
    )
    transactions = relationship("FinancialTransaction", back_populates="created_by")
    schedule_entries = relationship(
        "ScheduleParticipant", back_populates="user"
    )

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
