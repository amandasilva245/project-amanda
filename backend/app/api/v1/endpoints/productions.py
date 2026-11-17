from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.core.permissions import PRODUCTION_WRITE, PRODUCTION_DELETE, PARTICIPANT_ONLY
from app.models.user import User, UserRole
from app.models.production import ProductionParticipant
from app.schemas.production import (
    ProductionCreate, ProductionUpdate, ProductionResponse, ProductionDetailResponse,
    ParticipantCreate, ParticipantUpdate, ParticipantResponse,
)
from app.services.production_service import ProductionService

router = APIRouter()

WRITE_ROLES = PRODUCTION_WRITE


# Aceita "/productions" e "/productions/" sem redirecionamento 307, que
# perdia o header Authorization quando o host/porta mudava atrás do proxy.
@router.get("", response_model=dict)
@router.get("/", response_model=dict, include_in_schema=False)
def list_productions(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = ProductionService(db)

    from app.models.production import ProductionStatus
    status_enum = None
    if status:
        try:
            status_enum = ProductionStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status value")

    # Atores e técnicos só veem as produções de que participam (RF11),
    # mas com os mesmos filtros e paginação dos demais papéis.
    participant_id = current_user.id if current_user.role in PARTICIPANT_ONLY else None
    productions, total = service.list_all(
        status=status_enum, search=search, limit=limit, offset=offset, participant_user_id=participant_id,
    )
    return {
        "items": [ProductionResponse.model_validate(p) for p in productions],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("", response_model=ProductionResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ProductionResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_production(
    payload: ProductionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    service = ProductionService(db)
    production = service.create(payload, current_user.id)
    return ProductionResponse.model_validate(production)


@router.get("/{production_id}", response_model=ProductionDetailResponse)
def get_production(
    production_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = ProductionService(db)
    production = service.get_by_id(production_id)
    if not production:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")

    # Atores e técnicos só veem produções de que participam (RF11)
    if current_user.role in PARTICIPANT_ONLY:
        participant_ids = {p.user_id for p in production.participants}
        if current_user.id not in participant_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return ProductionDetailResponse.model_validate(production)


@router.patch("/{production_id}", response_model=ProductionResponse)
def update_production(
    production_id: str,
    payload: ProductionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    service = ProductionService(db)
    production = service.get_by_id(production_id)
    if not production:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")

    try:
        updated = service.update(production, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return ProductionResponse.model_validate(updated)


@router.delete("/{production_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_production(
    production_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PRODUCTION_DELETE)),
):
    service = ProductionService(db)
    production = service.get_by_id(production_id)
    if not production:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    service.delete(production)


@router.post("/{production_id}/participants", response_model=ParticipantResponse, status_code=201)
def add_participant(
    production_id: str,
    payload: ParticipantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    service = ProductionService(db)
    production = service.get_by_id(production_id)
    if not production:
        raise HTTPException(status_code=404, detail="Production not found")

    try:
        participant = service.add_participant(production, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    db.refresh(participant)
    db.refresh(participant.user)
    return ParticipantResponse.model_validate(participant)


@router.patch("/{production_id}/participants/{participant_id}", response_model=ParticipantResponse)
def update_participant(
    production_id: str,
    participant_id: str,
    payload: ParticipantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    """Edita função, personagem, cachê, valor pago e as marcações principal/confirmado (RF13)."""
    service = ProductionService(db)
    participant = service.get_participant(participant_id, production_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    try:
        participant = service.update_participant(participant, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return ParticipantResponse.model_validate(participant)


@router.delete("/{production_id}/participants/{participant_id}", status_code=204)
def remove_participant(
    production_id: str,
    participant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    service = ProductionService(db)
    removed = service.remove_participant(participant_id, production_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Participant not found")
