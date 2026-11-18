"""Venda online (fase 8): pedidos, reserva de lugares e confirmação do pagamento.

Fluxo:
1. O comprador escolhe a sessão e a quantidade. O lote é travado (FOR UPDATE),
   os lugares são guardados como ingressos "reservados" e o pedido fica
   "pendente" por ORDER_HOLD_MINUTES.
2. O Curtain cria a preferência no Mercado Pago e devolve o link do checkout.
3. O pagamento é confirmado lendo a API do Mercado Pago (pelo aviso/webhook ou
   quando o comprador volta ao site). Aprovado: ingressos confirmados.
4. Pedidos que vencem sem pagamento voltam a liberar os lugares.
"""

import hmac
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.core.config import local_time, settings
from app.models.order import OrderStatus, TicketOrder
from app.models.production import Production
from app.models.ticket import Ticket, TicketBatch, TicketBatchStatus, TicketStatus
from app.services import mercadopago as mp
from app.services.ticket_service import TicketError, TicketService

logger = logging.getLogger(__name__)
CENT = Decimal("0.01")


def _now():
    return datetime.now(timezone.utc)


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.tickets = TicketService(db)

    # ── Vitrine ────────────────────────────────────────────────────────────
    def public_batches(self) -> List[TicketBatch]:
        """Sessões à venda de produções marcadas como públicas."""
        self.expire_stale()
        now = _now()
        batches = (
            self.db.query(TicketBatch)
            .join(Production, Production.id == TicketBatch.production_id)
            .options(joinedload(TicketBatch.production))
            .filter(
                Production.is_public.is_(True),
                TicketBatch.status.in_([TicketBatchStatus.ON_SALE, TicketBatchStatus.SOLD_OUT]),
                TicketBatch.performance_date > now,
            )
            .order_by(TicketBatch.performance_date)
            .all()
        )
        return [b for b in batches if not (b.sale_end and b.sale_end < now)]

    # ── Pedido ─────────────────────────────────────────────────────────────
    def create_order(self, data) -> TicketOrder:
        status = mp.gateway_status()
        if not status["enabled"]:
            raise TicketError(status["reason"], 503)
        self.expire_stale()

        batch = self.tickets._lock_batch(data.batch_id)
        production = self.db.query(Production).filter(Production.id == batch.production_id).first()
        now = _now()
        if not production or not production.is_public:
            raise TicketError("Sessão não disponível para venda online.", 404)
        if batch.performance_date <= now:
            raise TicketError("Esta sessão já aconteceu.", 409)
        if batch.status != TicketBatchStatus.ON_SALE:
            raise TicketError("Ingressos esgotados para esta sessão." if batch.status == TicketBatchStatus.SOLD_OUT
                              else "Vendas encerradas para esta sessão.", 409)
        if batch.sale_start and now < batch.sale_start:
            raise TicketError("As vendas desta sessão ainda não começaram.", 409)
        if batch.sale_end and now > batch.sale_end:
            raise TicketError("O período de vendas desta sessão terminou.", 409)
        available = batch.total_seats - batch.tickets_sold
        if data.quantity > available:
            raise TicketError("Ingressos esgotados para esta sessão." if available <= 0
                              else f"Restam apenas {available} lugares nesta sessão.", 409)
        if data.is_premium and batch.price_premium is None:
            raise TicketError("Esta sessão não tem ingresso premium.")

        unit_price = Decimal(batch.price_premium if data.is_premium else batch.price).quantize(CENT)
        if unit_price <= 0:
            raise TicketError("Sessões gratuitas não passam pela venda online.", 409)

        order = TicketOrder(
            batch_id=batch.id,
            buyer_name=data.buyer_name.strip(),
            buyer_email=str(data.buyer_email).lower(),
            buyer_phone=data.buyer_phone or None,
            accepted_terms_at=now,
            quantity=data.quantity,
            is_premium=data.is_premium,
            unit_price=unit_price,
            total_amount=(unit_price * data.quantity).quantize(CENT),
            status=OrderStatus.PENDING,
            expires_at=now + timedelta(minutes=settings.ORDER_HOLD_MINUTES),
        )
        self.db.add(order)
        self.db.flush()
        for _ in range(data.quantity):
            self.db.add(Ticket(
                batch_id=batch.id, order_id=order.id, code=self.tickets._unique_code(),
                buyer_name=order.buyer_name, buyer_email=order.buyer_email, buyer_phone=order.buyer_phone,
                is_premium=data.is_premium, price_paid=unit_price, status=TicketStatus.RESERVED,
                notes="Venda online",
            ))
        batch.tickets_sold += data.quantity
        self.tickets._sync_status(batch)
        self.db.commit()  # libera o lote antes de chamar o Mercado Pago

        title = f"{production.title} · {local_time(batch.performance_date).strftime('%d/%m/%Y %H:%M')}"
        if data.quantity > 1 or data.is_premium:
            title += f" · {'premium' if data.is_premium else 'inteira'}"
        try:
            pref = mp.create_preference(
                order_id=order.id, title=title, quantity=order.quantity, unit_price=order.unit_price,
                payer_name=order.buyer_name, payer_email=order.buyer_email,
                return_url=self.return_url(order), expires_at_iso=order.expires_at.isoformat(timespec="milliseconds"),
            )
        except mp.PaymentGatewayError as exc:
            self._close(order.id, OrderStatus.FAILED, provider_status="preference_error")
            raise TicketError(str(exc), 502) from exc

        order = self.db.query(TicketOrder).filter(TicketOrder.id == order.id).first()
        order.provider_preference_id = pref["id"]
        order.checkout_url = pref["checkout_url"]
        self.db.commit()
        self.db.refresh(order)
        return order

    @staticmethod
    def return_url(order: TicketOrder) -> str:
        base = settings.PUBLIC_SITE_URL.rstrip("/")
        return f"{base}/ingressos/pedido/{order.id}?t={order.public_token}"

    def get_by_token(self, order_id: str, token: str) -> TicketOrder:
        order = (
            self.db.query(TicketOrder)
            .options(joinedload(TicketOrder.batch).joinedload(TicketBatch.production), joinedload(TicketOrder.tickets))
            .filter(TicketOrder.id == order_id)
            .first()
        )
        if not order or not token or not hmac.compare_digest(order.public_token, token):
            raise TicketError("Pedido não encontrado.", 404)
        return order

    # ── Pagamento ──────────────────────────────────────────────────────────
    def sync_from_gateway(self, order: TicketOrder) -> TicketOrder:
        """Consulta o Mercado Pago e aplica o pagamento mais recente do pedido."""
        if order.status not in (OrderStatus.PENDING, OrderStatus.EXPIRED):
            return order
        try:
            payments = mp.search_payments(order.id)
        except mp.PaymentGatewayError as exc:
            raise TicketError(str(exc), 502) from exc
        # Um aprovado tem prioridade sobre tentativas recusadas
        chosen = next((p for p in payments if p.get("status") == "approved"), payments[0] if payments else None)
        if chosen:
            self.apply_payment(chosen)
        return self.get_by_token(order.id, order.public_token)

    def handle_notification(self, payment_id: str) -> Optional[TicketOrder]:
        """Aviso do Mercado Pago: lê o pagamento na API e aplica."""
        try:
            payment = mp.get_payment(payment_id)
        except mp.PaymentGatewayError as exc:
            logger.warning("Aviso de pagamento não processado: %s", exc)
            raise TicketError(str(exc), 502) from exc
        return self.apply_payment(payment)

    def list_orders(self, status: Optional[OrderStatus] = None, limit: int = 200) -> List[TicketOrder]:
        self.expire_stale()
        q = self.db.query(TicketOrder)
        if status:
            q = q.filter(TicketOrder.status == status)
        return q.order_by(TicketOrder.created_at.desc()).limit(limit).all()

    def apply_payment(self, payment: dict) -> Optional[TicketOrder]:
        order_id = str(payment.get("external_reference") or "")
        order = (
            self.db.query(TicketOrder).filter(TicketOrder.id == order_id)
            .with_for_update().populate_existing().first()
        )
        if not order:
            logger.warning("Pagamento %s sem pedido correspondente.", payment.get("id"))
            return None

        status = str(payment.get("status") or "")
        order.provider_payment_id = str(payment.get("id") or order.provider_payment_id or "") or None
        order.provider_status = status[:40] or None

        if status == "approved":
            amount = Decimal(str(payment.get("transaction_amount", "0"))).quantize(CENT)
            if payment.get("currency_id", "BRL") != "BRL" or amount != order.total_amount:
                logger.error("Pagamento %s com valor divergente do pedido %s.", payment.get("id"), order.id)
                order.provider_status = "amount_mismatch"
                self.db.commit()
                return order
            if order.status == OrderStatus.PENDING:
                self._confirm(order)
            elif order.status in (OrderStatus.EXPIRED, OrderStatus.FAILED):
                self._revive_or_flag(order)
        elif status in ("refunded", "charged_back") and order.status == OrderStatus.PAID:
            self._close(order.id, OrderStatus.REFUNDED, provider_status=status, locked=order)
            return order
        self.db.commit()
        return order

    def _confirm(self, order: TicketOrder) -> None:
        now = _now()
        for t in order.tickets:
            if t.status == TicketStatus.RESERVED:
                t.status = TicketStatus.CONFIRMED
                t.purchase_date = now
        order.status = OrderStatus.PAID
        order.paid_at = now

    def _revive_or_flag(self, order: TicketOrder) -> None:
        """Pagou depois do prazo: tenta reaver os lugares; se não houver, marca para estorno."""
        batch = self.tickets._lock_batch(order.batch_id)
        if batch.status != TicketBatchStatus.CANCELLED and batch.total_seats - batch.tickets_sold >= order.quantity:
            for t in order.tickets:
                if t.status == TicketStatus.CANCELLED:
                    t.status = TicketStatus.RESERVED
                    t.cancelled_at = None
            batch.tickets_sold += order.quantity
            self.tickets._sync_status(batch)
            self._confirm(order)
        else:
            order.status = OrderStatus.NEEDS_REFUND
            logger.error("Pedido %s pago sem lugar disponível: estornar no Mercado Pago.", order.id)

    # ── Expiração e liberação de lugares ──────────────────────────────────
    def expire_stale(self) -> int:
        ids = [
            row.id for row in self.db.query(TicketOrder.id)
            .filter(TicketOrder.status == OrderStatus.PENDING, TicketOrder.expires_at < _now())
            .limit(200).all()
        ]
        for oid in ids:
            self._close(oid, OrderStatus.EXPIRED, only_if_pending=True)
        return len(ids)

    def _close(self, order_id: str, new_status: OrderStatus, provider_status: Optional[str] = None,
               only_if_pending: bool = False, locked: Optional[TicketOrder] = None) -> None:
        """Encerra o pedido e devolve ao lote os lugares que ainda estavam ocupados."""
        order = locked or (
            self.db.query(TicketOrder).filter(TicketOrder.id == order_id)
            .with_for_update().populate_existing().first()
        )
        if not order or (only_if_pending and order.status != OrderStatus.PENDING):
            self.db.commit()
            return
        batch = self.tickets._lock_batch(order.batch_id)
        released = 0
        now = _now()
        for t in self.db.query(Ticket).filter(Ticket.order_id == order.id).populate_existing().all():
            if t.status in (TicketStatus.RESERVED, TicketStatus.CONFIRMED):
                t.status = TicketStatus.CANCELLED
                t.cancelled_at = now
                released += 1
        batch.tickets_sold = max(0, batch.tickets_sold - released)
        self.tickets._sync_status(batch)
        order.status = new_status
        if provider_status:
            order.provider_status = provider_status
        self.db.commit()
