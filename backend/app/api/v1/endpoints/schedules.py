from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.core.permissions import PARTICIPANT_ONLY, SCHEDULE_WRITE
from app.models.user import User
from app.schemas.schedule import (
    AttendanceUpdate, ConflictItem, ScheduleCancel, ScheduleCreate, ScheduleResponse, ScheduleUpdate,
)
from app.services.schedule_service import ScheduleError, ScheduleService

router = APIRouter()


def _conflict_response(conflicts):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content=jsonable_encoder({
            "detail": "Há participantes com outro compromisso nesse horário.",
            "conflicts": [ConflictItem(**c) for c in conflicts],
        }),
    )


def _get_visible(service: ScheduleService, schedule_id: str, user: User):
    schedule = service.get(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if user.role in PARTICIPANT_ONLY and not service.can_view(schedule, user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return schedule


@router.get("", response_model=List[ScheduleResponse])
def list_schedules(
    production_id: Optional[str] = Query(None),
    start: Optional[datetime] = Query(None, description="Eventos que terminam a partir deste instante"),
    end: Optional[datetime] = Query(None, description="Eventos que começam até este instante"),
    user_id: Optional[str] = Query(None, description="Agenda de uma pessoa (convidada)"),
    include_cancelled: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = ScheduleService(db)
    visible_to = current_user.id if current_user.role in PARTICIPANT_ONLY else None
    return service.list(
        production_id=production_id, start=start, end=end, user_id=user_id,
        include_cancelled=include_cancelled, visible_to_participant=visible_to,
    )


@router.get("/conflicts", response_model=List[ConflictItem])
def check_conflicts(
    start: datetime,
    end: datetime,
    user_ids: List[str] = Query(default=[]),
    exclude_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*SCHEDULE_WRITE)),
):
    """Consulta prévia de conflitos de horário (usada pelo formulário)."""
    return ScheduleService(db).find_conflicts(user_ids, start, end, exclude_id=exclude_id)


@router.get("/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return _get_visible(ScheduleService(db), schedule_id, current_user)


@router.post("", response_model=ScheduleResponse, status_code=201,
             responses={409: {"description": "Conflito de horário (envie allow_conflicts=true para manter)"}})
def create_schedule(
    payload: ScheduleCreate,
    allow_conflicts: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*SCHEDULE_WRITE)),
):
    service = ScheduleService(db)
    try:
        schedule, conflicts = service.create(payload, allow_conflicts=allow_conflicts)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ScheduleError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if schedule is None:
        return _conflict_response(conflicts)
    return schedule


@router.patch("/{schedule_id}", response_model=ScheduleResponse,
              responses={409: {"description": "Conflito de horário"}})
def update_schedule(
    schedule_id: str,
    payload: ScheduleUpdate,
    allow_conflicts: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*SCHEDULE_WRITE)),
):
    service = ScheduleService(db)
    schedule = service.get(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    try:
        updated, conflicts = service.update(schedule, payload, allow_conflicts=allow_conflicts)
    except ScheduleError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if updated is None:
        return _conflict_response(conflicts)
    return updated


@router.post("/{schedule_id}/cancel", response_model=ScheduleResponse)
def cancel_schedule(
    schedule_id: str,
    payload: ScheduleCancel = ScheduleCancel(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*SCHEDULE_WRITE)),
):
    """Cancelamento lógico (RF17): o evento permanece no histórico."""
    service = ScheduleService(db)
    schedule = service.get(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return service.cancel(schedule, payload.reason)


@router.post("/{schedule_id}/restore", response_model=ScheduleResponse)
def restore_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*SCHEDULE_WRITE)),
):
    service = ScheduleService(db)
    schedule = service.get(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return service.restore(schedule)


@router.patch("/{schedule_id}/attendance/{user_id}", response_model=ScheduleResponse)
def set_attendance(
    schedule_id: str,
    user_id: str,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Presença (RF16). A coordenação marca qualquer convidado; cada pessoa pode marcar a própria."""
    service = ScheduleService(db)
    schedule = _get_visible(service, schedule_id, current_user)
    if current_user.role not in SCHEDULE_WRITE and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if schedule.is_cancelled:
        raise HTTPException(status_code=422, detail="Evento cancelado.")
    try:
        return service.set_attendance(schedule, user_id, payload.status, payload.notes)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
