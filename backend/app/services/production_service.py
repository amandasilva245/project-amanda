from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.models.production import Production, ProductionParticipant, ProductionStatus
from app.models.user import User
from app.schemas.production import ProductionCreate, ProductionUpdate, ParticipantCreate
from app.core.security import hash_password

try:
    from slugify import slugify
except ImportError:
    def slugify(text):
        return text.lower().replace(" ", "-")


class ProductionService:
    def __init__(self, db: Session):
        self.db = db

    def _make_slug(self, title: str) -> str:
        base_slug = slugify(title)
        slug = base_slug
        counter = 1
        while self.db.query(Production).filter(Production.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug

    def _check_company(self, company_id):
        from app.models.company import Company

        if company_id and not self.db.query(Company.id).filter(Company.id == company_id).first():
            raise ValueError("Companhia não encontrada.")

    def create(self, data: ProductionCreate, created_by_id: str) -> Production:
        values = data.model_dump(exclude_none=True)
        if not values.get("company_id"):
            values.pop("company_id", None)
        self._check_company(values.get("company_id"))
        production = Production(
            **values,
            slug=self._make_slug(data.title),
            created_by_id=created_by_id,
        )
        self.db.add(production)
        self.db.commit()
        self.db.refresh(production)
        return production

    def get_by_id(self, production_id: str) -> Optional[Production]:
        return (
            self.db.query(Production)
            .options(
                joinedload(Production.created_by),
                joinedload(Production.participants).joinedload(ProductionParticipant.user),
            )
            .filter(Production.id == production_id)
            .first()
        )

    def get_by_slug(self, slug: str) -> Optional[Production]:
        return (
            self.db.query(Production)
            .options(
                joinedload(Production.created_by),
                joinedload(Production.participants).joinedload(ProductionParticipant.user),
            )
            .filter(Production.slug == slug)
            .first()
        )

    def list_all(
        self,
        status: Optional[ProductionStatus] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        participant_user_id: Optional[str] = None,
        company_id: Optional[str] = None,
    ) -> tuple[List[Production], int]:
        query = self.db.query(Production).options(joinedload(Production.created_by))
        if company_id:
            query = query.filter(Production.company_id == company_id)

        if participant_user_id:
            query = query.filter(
                Production.participants.any(ProductionParticipant.user_id == participant_user_id)
            )

        if status:
            query = query.filter(Production.status == status)

        if search:
            query = query.filter(
                or_(
                    Production.title.ilike(f"%{search}%"),
                    Production.playwright.ilike(f"%{search}%"),
                )
            )

        total = query.count()
        productions = (
            query.order_by(Production.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )
        return productions, total

    def list_for_user(self, user_id: str) -> List[Production]:
        """Productions where user is a participant."""
        return (
            self.db.query(Production)
            .join(ProductionParticipant)
            .filter(ProductionParticipant.user_id == user_id)
            .options(joinedload(Production.created_by))
            .order_by(Production.updated_at.desc())
            .all()
        )

    def update(self, production: Production, data: ProductionUpdate) -> Production:
        update_data = data.model_dump(exclude_none=True)
        if update_data.get("company_id") == "":  # "" = sem companhia
            update_data["company_id"] = None
        self._check_company(update_data.get("company_id"))
        start = update_data.get("start_date", production.start_date)
        end = update_data.get("end_date", production.end_date)
        if start and end and end < start:
            raise ValueError("A data de encerramento não pode ser anterior à data de início.")
        for field, value in update_data.items():
            setattr(production, field, value)
        self.db.commit()
        self.db.refresh(production)
        return production

    def delete(self, production: Production) -> None:
        from app.models.order import TicketOrder
        from app.models.ticket import TicketBatch

        has_orders = (
            self.db.query(TicketOrder.id)
            .join(TicketBatch, TicketBatch.id == TicketOrder.batch_id)
            .filter(TicketBatch.production_id == production.id)
            .first()
        )
        if has_orders:
            raise ValueError("Esta produção tem pedidos da venda online; arquive-a em vez de excluir.")
        self.db.delete(production)
        self.db.commit()

    def add_participant(self, production: Production, data: ParticipantCreate) -> ProductionParticipant:
        if not self.db.query(User).filter(User.id == data.user_id, User.is_active == True).first():
            raise ValueError("Pessoa não encontrada ou inativa.")
        participant = ProductionParticipant(
            production_id=production.id,
            **data.model_dump(exclude_none=True),
        )
        self.db.add(participant)
        self.db.commit()
        self.db.refresh(participant)
        return participant

    def get_participant(self, participant_id: str, production_id: str) -> Optional[ProductionParticipant]:
        return (
            self.db.query(ProductionParticipant)
            .options(joinedload(ProductionParticipant.user))
            .filter(
                ProductionParticipant.id == participant_id,
                ProductionParticipant.production_id == production_id,
            )
            .first()
        )

    def update_participant(self, participant: ProductionParticipant, data) -> ProductionParticipant:
        update_data = data.model_dump(exclude_unset=True)
        # Campos de texto podem ser limpos (""); flags e valores só mudam se enviados
        start = update_data.get("start_date", participant.start_date)
        end = update_data.get("end_date", participant.end_date)
        if start and end and end < start:
            raise ValueError("A data final não pode ser anterior à data inicial.")
        fee = update_data.get("fee", participant.fee)
        fee_paid = update_data.get("fee_paid", participant.fee_paid)
        if fee is not None and fee_paid is not None and fee_paid > fee:
            raise ValueError("O valor pago não pode ser maior que o cachê.")
        for field, value in update_data.items():
            if field in ("role_title", "department", "is_lead", "is_confirmed") and value is None:
                continue
            setattr(participant, field, value)
        self.db.commit()
        self.db.refresh(participant)
        return participant

    def remove_participant(self, participant_id: str, production_id: str) -> bool:
        participant = (
            self.db.query(ProductionParticipant)
            .filter(
                ProductionParticipant.id == participant_id,
                ProductionParticipant.production_id == production_id,
            )
            .first()
        )
        if not participant:
            return False
        self.db.delete(participant)
        self.db.commit()
        return True
