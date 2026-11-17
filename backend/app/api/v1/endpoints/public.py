"""Venda online de ingressos (fase 8). Rotas sem login, usadas pelo público.

Só funciona com PUBLIC_SALES_ENABLED=true e uma credencial de TESTE do
Mercado Pago; com credencial de produção a venda fica bloqueada (ver
app/services/mercadopago.py).
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.config import settings
from app.core.database import get_db
from app.core.privacy import mask_email
from app.models.order import OrderStatus, TicketOrder
from app.schemas.order import (
    OrderCreate, OrderCreated, OrderRefresh, OrderTicket, OrderView, PublicEvent, PublicSalesStatus,
)
from app.services import mercadopago as mp
from app.services.order_service import OrderService
from app.services.ticket_service import TicketError

router = APIRouter()
logger = logging.getLogger(__name__)

ORDERS_PER_WINDOW = 10
REFRESH_PER_WINDOW = 30
WINDOW = 10 * 60


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "desconhecido"


def _limit(bucket: str, request: Request, limit: int):
    if not rate_limit.hit(bucket, _client_ip(request), limit, WINDOW):
        raise HTTPException(status_code=429, detail="Muitas tentativas. Aguarde alguns minutos e tente de novo.")


def _fail(exc: TicketError):
    raise HTTPException(status_code=exc.status_code, detail=str(exc))


def _view(order: TicketOrder) -> OrderView:
    batch = order.batch
    production = batch.production
    paid = order.status == OrderStatus.PAID
    return OrderView(
        id=order.id, status=order.status, quantity=order.quantity, is_premium=order.is_premium,
        unit_price=order.unit_price, total_amount=order.total_amount, expires_at=order.expires_at,
        paid_at=order.paid_at, created_at=order.created_at,
        buyer_name=order.buyer_name, buyer_email=mask_email(order.buyer_email),
        production_title=production.title, performance_date=batch.performance_date,
        venue=production.venue, venue_section=batch.venue_section,
        checkout_url=order.checkout_url if order.status == OrderStatus.PENDING else None,
        # Os códigos só aparecem depois do pagamento aprovado
        tickets=[OrderTicket(code=t.code, is_premium=t.is_premium, status=t.status)
                 for t in order.tickets] if paid else [],
    )


@router.get("/status", response_model=PublicSalesStatus)
def sales_status():
    s = mp.gateway_status()
    return PublicSalesStatus(**s, hold_minutes=settings.ORDER_HOLD_MINUTES)


@router.get("/events", response_model=List[PublicEvent])
def public_events(db: Session = Depends(get_db)):
    events = []
    for b in OrderService(db).public_batches():
        p = b.production
        available = max(0, b.total_seats - b.tickets_sold)
        events.append(PublicEvent(
            batch_id=b.id, production_id=p.id, title=p.title, subtitle=p.subtitle, synopsis=p.synopsis,
            playwright=p.playwright, venue=p.venue, poster_url=p.poster_url, color_accent=p.color_accent,
            performance_date=b.performance_date, venue_section=b.venue_section,
            price=b.price, price_premium=b.price_premium, available_seats=available,
            sold_out=available <= 0 or b.status.value == "sold_out",
        ))
    return events


@router.post("/orders", response_model=OrderCreated, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, request: Request, db: Session = Depends(get_db)):
    _limit("public-order", request, ORDERS_PER_WINDOW)
    try:
        order = OrderService(db).create_order(payload)
    except TicketError as exc:
        _fail(exc)
    return OrderCreated(
        order_id=order.id, token=order.public_token, checkout_url=order.checkout_url,
        expires_at=order.expires_at, total_amount=order.total_amount,
    )


@router.get("/orders/{order_id}", response_model=OrderView)
def get_order(order_id: str, t: str = Query(..., min_length=10, max_length=64), db: Session = Depends(get_db)):
    service = OrderService(db)
    service.expire_stale()
    try:
        return _view(service.get_by_token(order_id, t))
    except TicketError as exc:
        _fail(exc)


@router.post("/orders/{order_id}/refresh", response_model=OrderView)
def refresh_order(order_id: str, payload: OrderRefresh, request: Request, db: Session = Depends(get_db)):
    """Confere o pagamento direto no Mercado Pago (útil quando o aviso não chega)."""
    _limit("public-refresh", request, REFRESH_PER_WINDOW)
    service = OrderService(db)
    try:
        order = service.get_by_token(order_id, payload.token)
        order = service.sync_from_gateway(order)
        service.expire_stale()
        return _view(service.get_by_token(order_id, payload.token))
    except TicketError as exc:
        _fail(exc)


@router.post("/payments/mercadopago/webhook")
async def mercadopago_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_signature: Optional[str] = Header(None),
    x_request_id: Optional[str] = Header(None),
):
    """Aviso do Mercado Pago. O corpo é só um gatilho: o pagamento é lido na API."""
    params = request.query_params
    try:
        body = await request.json()
    except Exception:
        body = {}
    kind = params.get("type") or params.get("topic") or body.get("type") or body.get("topic")
    data_id = params.get("data.id") or params.get("id") or (body.get("data") or {}).get("id")

    if not mp.verify_webhook_signature(x_signature=x_signature, x_request_id=x_request_id,
                                       data_id=params.get("data.id") or data_id):
        logger.warning("Aviso do Mercado Pago com assinatura inválida.")
        raise HTTPException(status_code=401, detail="Assinatura inválida.")
    if kind != "payment" or not data_id:
        return {"received": True}
    try:
        OrderService(db).handle_notification(str(data_id))
    except TicketError:
        # Mercado Pago fora do ar: 503 faz ele reenviar o aviso mais tarde
        raise HTTPException(status_code=503, detail="Tente novamente mais tarde.")
    return {"received": True}
