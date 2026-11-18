"""Companhias teatrais e recursos de produção (figurinos, cenários, equipamentos)."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


def _now():
    return datetime.now(timezone.utc)


class Company(Base):
    """Companhia (grupo) responsável por produções. Cadastro organizacional:
    o Curtain não é multiempresa, então todos os usuários enxergam todas."""

    __tablename__ = "companies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    responsible_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    city = Column(String(120), nullable=True)
    founded_year = Column(Integer, nullable=True)
    website = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    productions = relationship("Production", back_populates="company")


class ResourceType(str, enum.Enum):
    COSTUME = "costume"      # figurino
    SET = "set"              # cenário
    EQUIPMENT = "equipment"  # equipamento (luz, som, vídeo)
    PROP = "prop"            # objeto de cena
    OTHER = "other"


class ResourceStatus(str, enum.Enum):
    PLANNED = "planned"          # previsto / a providenciar
    IN_PROGRESS = "in_progress"  # em confecção ou em compra
    AVAILABLE = "available"      # pronto, no acervo
    IN_USE = "in_use"            # em uso na produção
    MAINTENANCE = "maintenance"  # em manutenção


class ProductionResource(Base):
    __tablename__ = "production_resources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    production_id = Column(String(36), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(Enum(ResourceType, name="resourcetype"), nullable=False, index=True)
    status = Column(Enum(ResourceStatus, name="resourcestatus"), nullable=False, default=ResourceStatus.PLANNED)
    quantity = Column(Integer, nullable=False, default=1)
    unit_cost = Column(Numeric(10, 2), nullable=True)
    supplier = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    responsible_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    production = relationship("Production", back_populates="resources")
    responsible = relationship("User")

    @property
    def total_cost(self):
        return (self.unit_cost or 0) * (self.quantity or 0)
