"""Bilheteria interna (RF22–RF24). A venda pública online não faz parte desta fase."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.permissions import TICKETS_CHECKIN, TICKETS_MANAGE
from app.models.user import User
from app.schemas.ticket import (
    CheckInRequest, CheckInResult, TicketBatchCreate, TicketBatchResponse, TicketBatchUpdate,
    TicketCreate, TicketResponse, TicketSalesSummary,
)
from app.models.order import OrderStatus
from app.schemas.order import OrderAdmin
from app.services.order_service import OrderService
from app.services.ticket_service import TicketError, TicketService

router = APIRouter()


def _fail(exc: TicketError):
    raise HTTPException(status_code=exc.status_code, detail=str(exc))


def _mask(ticket: TicketResponse) -> TicketResponse:
    """LGPD: quem só faz check-in vê o nome, não e-mail/telefone do comprador."""
    email = ticket.buyer_email
    local, _, domain = email.partition("@")
    return ticket.model_copy(update={"buyer_email": f"{local[:1]}***@{domain}", "buyer_phone": None})


def _can_see_buyer(user: User) -> bool:
    return user.role in TICKETS_MANAGE


# ── Lotes ─────────────────────────────────────────────────────────────────────
@router.get("/batches", response_model=List[TicketBatchResponse])
def list_batches(
    production_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_CHECKIN)),
):
    return TicketService(db).list_batches(production_id)


@router.post("/batches", response_model=TicketBatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    payload: TicketBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_MANAGE)),
):
    try:
        return TicketService(db).create_batch(payload)
    except TicketError as exc:
        _fail(exc)


@router.patch("/batches/{batch_id}", response_model=TicketBatchResponse)
def update_batch(
    batch_id: str,
    payload: TicketBatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_MANAGE)),
):
    service = TicketService(db)
    batch = service.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Lote não encontrado.")
    try:
        return service.update_batch(batch, payload)
    except TicketError as exc:
        _fail(exc)


@router.get("/batches/{batch_id}/tickets", response_model=List[TicketResponse])
def list_batch_tickets(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_CHECKIN)),
):
    service = TicketService(db)
    if not service.get_batch(batch_id):
        raise HTTPException(status_code=404, detail="Lote não encontrado.")
    tickets = [TicketResponse.model_validate(t) for t in service.list_tickets(batch_id)]
    return tickets if _can_see_buyer(current_user) else [_mask(t) for t in tickets]


@router.get("/summary/{production_id}", response_model=TicketSalesSummary)
def sales_summary(
    production_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_CHECKIN)),
):
    return TicketService(db).summary(production_id)


@router.get("/orders", response_model=List[OrderAdmin])
def list_online_orders(
    order_status: Optional[OrderStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_MANAGE)),
):
    """Pedidos da venda online (fase 8), mais recentes primeiro."""
    return OrderService(db).list_orders(order_status)


# ── Ingressos ─────────────────────────────────────────────────────────────────
@router.post("", response_model=List[TicketResponse], status_code=status.HTTP_201_CREATED)
def sell_tickets(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_MANAGE)),
):
    """Registra ingressos vendidos na bilheteria (balcão). Gera um código único por ingresso."""
    try:
        return TicketService(db).sell(payload)
    except TicketError as exc:
        _fail(exc)


@router.post("/check-in", response_model=CheckInResult)
def check_in(
    payload: CheckInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_CHECKIN)),
):
    """Valida a entrada pelo código. Atômico: o mesmo ingresso não entra duas vezes."""
    try:
        ticket = TicketService(db).check_in(payload.code, current_user.id)
    except TicketError as exc:
        _fail(exc)
    response = TicketResponse.model_validate(ticket)
    return CheckInResult(
        ticket=response if _can_see_buyer(current_user) else _mask(response),
        performance_date=ticket.batch.performance_date,
        production_title=ticket.batch.production.title,
    )


@router.post("/{ticket_id}/confirm", response_model=TicketResponse)
def confirm_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_MANAGE)),
):
    try:
        return TicketService(db).confirm(ticket_id)
    except TicketError as exc:
        _fail(exc)


@router.post("/{ticket_id}/cancel", response_model=TicketResponse)
def cancel_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*TICKETS_MANAGE)),
):
    """Cancela e devolve o lugar ao lote (que volta a ficar à venda se estava esgotado)."""
    try:
        return TicketService(db).cancel(ticket_id)
    except TicketError as exc:
        _fail(exc)
