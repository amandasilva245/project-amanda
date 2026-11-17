"""Pedidos da venda online (fase 8).

Um pedido guarda os lugares (ingressos "reservados") enquanto o comprador paga
no Mercado Pago. Nenhum dado de cartão passa pelo Curtain: o pagamento é feito
na página do Mercado Pago e aqui ficam só o número e o status do pagamento.
"""

import enum
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.core.database import Base


def _now():
    return datetime.now(timezone.utc)


class OrderStatus(str, enum.Enum):
    PENDING = "pending"            # lugares guardados, aguardando pagamento
    PAID = "paid"                  # pagamento aprovado, ingressos confirmados
    EXPIRED = "expired"            # prazo acabou sem pagamento; lugares devolvidos
    FAILED = "failed"              # pagamento recusado ou cancelado
    REFUNDED = "refunded"          # estornado; ingressos cancelados
    NEEDS_REFUND = "needs_refund"  # pago depois de expirar e sem lugar: estornar manualmente


class TicketOrder(Base):
    __tablename__ = "ticket_orders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Segredo do link de acompanhamento enviado ao comprador
    public_token = Column(String(64), unique=True, nullable=False, default=lambda: secrets.token_urlsafe(24))
    batch_id = Column(String(36), ForeignKey("ticket_batches.id", ondelete="RESTRICT"), nullable=False, index=True)

    buyer_name = Column(String(255), nullable=False)
    buyer_email = Column(String(255), nullable=False)
    buyer_phone = Column(String(30), nullable=True)
    accepted_terms_at = Column(DateTime(timezone=True), nullable=False)

    quantity = Column(Integer, nullable=False)
    is_premium = Column(Boolean, nullable=False, default=False)
    unit_price = Column(Numeric(8, 2), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)

    status = Column(Enum(OrderStatus, name="orderstatus"), nullable=False, default=OrderStatus.PENDING, index=True)
    provider = Column(String(30), nullable=False, default="mercadopago")
    provider_preference_id = Column(String(100), nullable=True)
    provider_payment_id = Column(String(100), nullable=True, index=True)
    provider_status = Column(String(40), nullable=True)
    checkout_url = Column(String(500), nullable=True)

    expires_at = Column(DateTime(timezone=True), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    batch = relationship("TicketBatch")
    tickets = relationship("Ticket", back_populates="order")
