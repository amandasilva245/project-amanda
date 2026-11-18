import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Enum, DateTime, Date,
    Integer, Numeric, ForeignKey, Boolean
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class ProductionStatus(str, enum.Enum):
    DEVELOPMENT = "development"
    PRE_PRODUCTION = "pre_production"
    REHEARSAL = "rehearsal"
    PERFORMANCE = "performance"
    ARCHIVED = "archived"


class ProductionGenre(str, enum.Enum):
    DRAMA = "drama"
    COMEDY = "comedy"
    MUSICAL = "musical"
    OPERA = "opera"
    DANCE = "dance"
    EXPERIMENTAL = "experimental"
    CHILDREN = "children"
    OTHER = "other"


class Department(str, enum.Enum):
    CAST = "cast"
    DIRECTION = "direction"
    TECHNICAL = "technical"
    PRODUCTION = "production"
    ADMINISTRATION = "administration"


class Production(Base):
    __tablename__ = "productions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    slug = Column(String(280), unique=True, nullable=False, index=True)
    subtitle = Column(String(255), nullable=True)
    synopsis = Column(Text, nullable=True)
    playwright = Column(String(255), nullable=True)

    status = Column(Enum(ProductionStatus), nullable=False, default=ProductionStatus.DEVELOPMENT)
    genre = Column(Enum(ProductionGenre), nullable=True)

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    first_performance_date = Column(Date, nullable=True)

    venue = Column(String(255), nullable=True)
    venue_capacity = Column(Integer, nullable=True)

    poster_url = Column(String(500), nullable=True)
    color_accent = Column(String(7), nullable=True, default="#A9874A")

    budget_total = Column(Numeric(12, 2), nullable=True, default=0)
    duration_minutes = Column(Integer, nullable=True)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)

    is_public = Column(Boolean, default=False)

    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
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
    created_by = relationship("User", back_populates="created_productions", foreign_keys=[created_by_id])
    participants = relationship("ProductionParticipant", back_populates="production", cascade="all, delete-orphan")
    transactions = relationship("FinancialTransaction", back_populates="production", cascade="all, delete-orphan")
    ticket_batches = relationship("TicketBatch", back_populates="production", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="production", cascade="all, delete-orphan")
    company = relationship("Company", back_populates="productions")
    resources = relationship("ProductionResource", back_populates="production", cascade="all, delete-orphan")
    tasks = relationship("ProductionTask", back_populates="production", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Production '{self.title}' [{self.status}]>"


class ProductionParticipant(Base):
    __tablename__ = "production_participants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    production_id = Column(String(36), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    role_title = Column(String(255), nullable=False)
    department = Column(Enum(Department), nullable=False, default=Department.CAST)
    character_name = Column(String(255), nullable=True)

    fee = Column(Numeric(10, 2), nullable=True)
    fee_paid = Column(Numeric(10, 2), nullable=True, default=0)

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    is_lead = Column(Boolean, default=False)
    is_confirmed = Column(Boolean, default=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    production = relationship("Production", back_populates="participants")
    user = relationship("User", back_populates="participations")
