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

    def create(self, data: ProductionCreate, created_by_id: str) -> Production:
        production = Production(
            **data.model_dump(exclude_none=True),
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
    ) -> tuple[List[Production], int]:
        query = self.db.query(Production).options(joinedload(Production.created_by))

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
        for field, value in update_data.items():
            setattr(production, field, value)
        self.db.commit()
        self.db.refresh(production)
        return production

    def delete(self, production: Production) -> None:
        self.db.delete(production)
        self.db.commit()

    def add_participant(self, production: Production, data: ParticipantCreate) -> ProductionParticipant:
        participant = ProductionParticipant(
            production_id=production.id,
            **data.model_dump(exclude_none=True),
        )
        self.db.add(participant)
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
