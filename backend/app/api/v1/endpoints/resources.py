"""Recursos de produção (figurinos, cenários, equipamentos, objetos de cena) e
tarefas. Atores e técnicos só veem itens das produções de que participam."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.permissions import PARTICIPANT_ONLY, RESOURCE_WRITE, TASK_WRITE
from app.models.company import ProductionResource, ResourceStatus, ResourceType
from app.models.production import Production, ProductionParticipant
from app.models.task import ProductionTask, TaskStatus
from app.models.user import User
from app.schemas.company import (
    ResourceCreate, ResourceResponse, ResourceUpdate, TaskCreate, TaskResponse, TaskUpdate, UserRef,
)

resources_router = APIRouter()
tasks_router = APIRouter()


# ── Visibilidade ──────────────────────────────────────────────────────────────
def _participant_production_ids(db: Session, user: User) -> set:
    rows = db.query(ProductionParticipant.production_id).filter(ProductionParticipant.user_id == user.id).all()
    return {r[0] for r in rows}


def _check_production(db: Session, user: User, production_id: str) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if not production:
        raise HTTPException(status_code=404, detail="Produção não encontrada.")
    if user.role in PARTICIPANT_ONLY and production_id not in _participant_production_ids(db, user):
        raise HTTPException(status_code=403, detail="Você não participa desta produção.")
    return production


def _check_user(db: Session, user_id: Optional[str]):
    if user_id and not db.query(User.id).filter(User.id == user_id).first():
        raise HTTPException(status_code=422, detail="Pessoa responsável não encontrada.")


# ── Recursos ──────────────────────────────────────────────────────────────────
def _resource_out(r: ProductionResource) -> ResourceResponse:
    return ResourceResponse(
        id=r.id, production_id=r.production_id,
        production_title=r.production.title if r.production else None,
        name=r.name, type=r.type, status=r.status, quantity=r.quantity, unit_cost=r.unit_cost,
        total_cost=Decimal(r.unit_cost or 0) * r.quantity, supplier=r.supplier, location=r.location,
        responsible=UserRef.model_validate(r.responsible) if r.responsible else None,
        notes=r.notes, created_at=r.created_at, updated_at=r.updated_at,
    )


def _can_write_resource(db: Session, user: User, production_id: str):
    if user.role not in RESOURCE_WRITE:
        raise HTTPException(status_code=403, detail="Sem permissão para alterar recursos.")
    _check_production(db, user, production_id)  # técnico: só nas produções em que participa


@resources_router.get("", response_model=List[ResourceResponse])
def list_resources(
    production_id: Optional[str] = Query(None),
    type: Optional[ResourceType] = Query(None),
    resource_status: Optional[ResourceStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = db.query(ProductionResource).options(
        joinedload(ProductionResource.production), joinedload(ProductionResource.responsible))
    if current_user.role in PARTICIPANT_ONLY:
        q = q.filter(ProductionResource.production_id.in_(_participant_production_ids(db, current_user) or {""}))
    if production_id:
        q = q.filter(ProductionResource.production_id == production_id)
    if type:
        q = q.filter(ProductionResource.type == type)
    if resource_status:
        q = q.filter(ProductionResource.status == resource_status)
    if search:
        q = q.filter(ProductionResource.name.ilike(f"%{search}%"))
    return [_resource_out(r) for r in q.order_by(ProductionResource.type, ProductionResource.name).all()]


@resources_router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(payload: ResourceCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_active_user)):
    _can_write_resource(db, current_user, payload.production_id)
    _check_user(db, payload.responsible_id)
    resource = ProductionResource(**payload.model_dump())
    resource.name = resource.name.strip()
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return _resource_out(resource)


def _get_resource(db: Session, resource_id: str) -> ProductionResource:
    r = db.query(ProductionResource).filter(ProductionResource.id == resource_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recurso não encontrado.")
    return r


@resources_router.patch("/{resource_id}", response_model=ResourceResponse)
def update_resource(resource_id: str, payload: ResourceUpdate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_active_user)):
    r = _get_resource(db, resource_id)
    _can_write_resource(db, current_user, r.production_id)
    changes = payload.model_dump(exclude_unset=True)
    _check_user(db, changes.get("responsible_id"))
    for key, value in changes.items():
        if key in ("name", "type", "status", "quantity") and value is None:
            continue
        setattr(r, key, value)
    db.commit()
    db.refresh(r)
    return _resource_out(r)


@resources_router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(resource_id: str, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_active_user)):
    r = _get_resource(db, resource_id)
    _can_write_resource(db, current_user, r.production_id)
    db.delete(r)
    db.commit()


# ── Tarefas ───────────────────────────────────────────────────────────────────
def _task_out(t: ProductionTask) -> TaskResponse:
    return TaskResponse(
        id=t.id, production_id=t.production_id,
        production_title=t.production.title if t.production else None,
        title=t.title, description=t.description,
        assignee=UserRef.model_validate(t.assignee) if t.assignee else None,
        due_date=t.due_date, status=t.status, priority=t.priority,
        overdue=bool(t.due_date and t.status != TaskStatus.DONE and t.due_date < date.today()),
        completed_at=t.completed_at, created_at=t.created_at,
    )


@tasks_router.get("", response_model=List[TaskResponse])
def list_tasks(
    production_id: Optional[str] = Query(None),
    task_status: Optional[TaskStatus] = Query(None, alias="status"),
    mine: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = db.query(ProductionTask).options(joinedload(ProductionTask.production), joinedload(ProductionTask.assignee))
    if current_user.role in PARTICIPANT_ONLY:
        q = q.filter(ProductionTask.production_id.in_(_participant_production_ids(db, current_user) or {""}))
    if production_id:
        q = q.filter(ProductionTask.production_id == production_id)
    if task_status:
        q = q.filter(ProductionTask.status == task_status)
    if mine:
        q = q.filter(ProductionTask.assignee_id == current_user.id)
    tasks = q.all()
    order = {TaskStatus.IN_PROGRESS: 0, TaskStatus.TODO: 1, TaskStatus.DONE: 2}
    tasks.sort(key=lambda t: (order[t.status], t.due_date or date.max, t.title))
    return [_task_out(t) for t in tasks]


@tasks_router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_active_user)):
    if current_user.role not in TASK_WRITE:
        raise HTTPException(status_code=403, detail="Sem permissão para criar tarefas.")
    _check_production(db, current_user, payload.production_id)
    _check_user(db, payload.assignee_id)
    task = ProductionTask(**payload.model_dump())
    task.title = task.title.strip()
    if task.status == TaskStatus.DONE:
        task.completed_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_out(task)


def _get_task(db: Session, task_id: str) -> ProductionTask:
    t = db.query(ProductionTask).filter(ProductionTask.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
    return t


@tasks_router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_active_user)):
    t = _get_task(db, task_id)
    changes = payload.model_dump(exclude_unset=True)
    is_coordinator = current_user.role in TASK_WRITE
    is_assignee = t.assignee_id == current_user.id
    if not is_coordinator:
        # O responsável pode apenas mudar o andamento da própria tarefa
        if not is_assignee or set(changes) - {"status"}:
            raise HTTPException(status_code=403, detail="Você só pode atualizar o andamento das suas tarefas.")
    _check_user(db, changes.get("assignee_id"))
    for key, value in changes.items():
        if key in ("title", "status", "priority") and value is None:
            continue
        setattr(t, key, value)
    if "status" in changes and changes["status"] is not None:
        t.completed_at = datetime.now(timezone.utc) if changes["status"] == TaskStatus.DONE else None
    db.commit()
    db.refresh(t)
    return _task_out(t)


@tasks_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_active_user)):
    if current_user.role not in TASK_WRITE:
        raise HTTPException(status_code=403, detail="Sem permissão para excluir tarefas.")
    db.delete(_get_task(db, task_id))
    db.commit()
