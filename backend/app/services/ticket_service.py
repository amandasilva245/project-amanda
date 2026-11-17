"""Bilheteria interna (RF22–RF24): lotes, registro de ingressos e check-in.

Garantias de concorrência:
* Venda: o lote é travado com SELECT ... FOR UPDATE antes de conferir a
  capacidade, então duas vendas simultâneas do último lugar resultam em uma
  venda e um erro (sem estouro de lotação).
* Check-in: um único UPDATE condicional (status = 'confirmed'), atômico no
  banco; o mesmo ingresso nunca entra duas vezes, mesmo com dois leitores.
"""

import secrets
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.config import local_time
from app.models.production import Production
from app.models.ticket import Ticket, TicketBatch, TicketBatchStatus, TicketStatus

# Sem 0/O, 1/I/L: o código é lido em voz alta e digitado na portaria
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 10
OCCUPYING = (TicketStatus.RESERVED, TicketStatus.CONFIRMED, TicketStatus.USED)
PAID = (TicketStatus.CONFIRMED, TicketStatus.USED)


class TicketError(ValueError):
    """Regra de negócio violada (vira 409/422 na API)."""

    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


class TicketService:
    def __init__(self, db: Session):
        self.db = db

    # ── Lotes ──────────────────────────────────────────────────────────────
    def list_batches(self, production_id: Optional[str] = None) -> List[TicketBatch]:
        q = self.db.query(TicketBatch)
        if production_id:
            q = q.filter(TicketBatch.production_id == production_id)
        return q.order_by(TicketBatch.performance_date).all()

    def get_batch(self, batch_id: str) -> Optional[TicketBatch]:
        return self.db.query(TicketBatch).filter(TicketBatch.id == batch_id).first()

    def create_batch(self, data) -> TicketBatch:
        if not self.db.query(Production.id).filter(Production.id == data.production_id).first():
            raise TicketError("Produção não encontrada.", 404)
        batch = TicketBatch(**data.model_dump(), tickets_sold=0, status=TicketBatchStatus.ON_SALE)
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def update_batch(self, batch: TicketBatch, data) -> TicketBatch:
        batch = self._lock_batch(batch.id)
        changes = data.model_dump(exclude_unset=True)
        if "total_seats" in changes and changes["total_seats"] is not None:
            if changes["total_seats"] < batch.tickets_sold:
                raise TicketError(
                    f"Já há {batch.tickets_sold} lugares ocupados; a capacidade não pode ser menor.", 409,
                )
        start = changes.get("sale_start", batch.sale_start)
        end = changes.get("sale_end", batch.sale_end)
        if start and end and end <= start:
            raise TicketError("O fim das vendas deve ser depois do início.")
        new_status = changes.pop("status", None)
        for key, value in changes.items():
            if key in ("performance_date", "total_seats", "price") and value is None:
                continue
            setattr(batch, key, value)
        if new_status is not None:
            if new_status == TicketBatchStatus.ON_SALE and batch.tickets_sold >= batch.total_seats:
                raise TicketError("Não há lugares livres para reabrir as vendas.", 409)
            batch.status = new_status
        else:
            self._sync_status(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def _lock_batch(self, batch_id: str) -> TicketBatch:
        batch = (
            self.db.query(TicketBatch)
            .filter(TicketBatch.id == batch_id)
            .with_for_update()
            .populate_existing()
            .first()
        )
        if not batch:
            raise TicketError("Lote não encontrado.", 404)
        return batch

    @staticmethod
    def _sync_status(batch: TicketBatch) -> None:
        """Esgotado automático (RF23) e reabertura quando um lugar é liberado."""
        if batch.status == TicketBatchStatus.ON_SALE and batch.tickets_sold >= batch.total_seats:
            batch.status = TicketBatchStatus.SOLD_OUT
        elif batch.status == TicketBatchStatus.SOLD_OUT and batch.tickets_sold < batch.total_seats:
            batch.status = TicketBatchStatus.ON_SALE

    # ── Ingressos ──────────────────────────────────────────────────────────
    def list_tickets(self, batch_id: str) -> List[Ticket]:
        return (
            self.db.query(Ticket)
            .filter(Ticket.batch_id == batch_id)
            .order_by(Ticket.purchase_date.desc())
            .all()
        )

    def sell(self, data) -> List[Ticket]:
        """Registra 1..N ingressos para o mesmo comprador (RF24)."""
        batch = self._lock_batch(data.batch_id)  # trava até o commit
        now = datetime.now(timezone.utc)

        if batch.status != TicketBatchStatus.ON_SALE:
            labels = {
                TicketBatchStatus.SOLD_OUT: "esgotado", TicketBatchStatus.CANCELLED: "cancelado",
                TicketBatchStatus.COMPLETED: "concluído",
            }
            raise TicketError(f"Lote {labels.get(batch.status, batch.status.value)}: vendas encerradas.", 409)
        if batch.sale_start and now < batch.sale_start:
            raise TicketError("As vendas deste lote ainda não começaram.", 409)
        if batch.sale_end and now > batch.sale_end:
            raise TicketError("O período de vendas deste lote terminou.", 409)

        available = batch.total_seats - batch.tickets_sold
        if data.quantity > available:
            raise TicketError(
                "Lotação esgotada." if available <= 0 else f"Restam apenas {available} lugares neste lote.", 409,
            )

        if data.is_premium and batch.price_premium is None:
            raise TicketError("Este lote não tem preço premium.")
        unit_price = data.price_paid
        if unit_price is None:
            unit_price = batch.price_premium if data.is_premium else batch.price

        tickets = []
        for _ in range(data.quantity):
            tickets.append(Ticket(
                batch_id=batch.id,
                code=self._unique_code(),
                buyer_name=data.buyer_name.strip(),
                buyer_email=str(data.buyer_email).lower(),
                buyer_phone=data.buyer_phone,
                seat_number=data.seat_number,
                is_premium=data.is_premium,
                price_paid=Decimal(unit_price),
                status=data.status,
                notes=data.notes,
            ))
        self.db.add_all(tickets)
        batch.tickets_sold += data.quantity
        self._sync_status(batch)
        try:
            self.db.commit()
        except IntegrityError:  # colisão de código (improvável): tenta de novo uma vez
            self.db.rollback()
            return self.sell(data)
        for t in tickets:
            self.db.refresh(t)
        return tickets

    def _unique_code(self) -> str:
        for _ in range(10):
            code = new_code()
            if not self.db.query(Ticket.id).filter(Ticket.code == code).first():
                return code
        raise TicketError("Não foi possível gerar um código único. Tente de novo.", 500)

    def _lock_ticket(self, ticket_id: str) -> Ticket:
        ticket = self.db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise TicketError("Ingresso não encontrado.", 404)
        return ticket

    def confirm(self, ticket_id: str) -> Ticket:
        """Reservado -> Confirmado (pagamento recebido no balcão)."""
        ticket = self._lock_ticket(ticket_id)
        if ticket.status != TicketStatus.RESERVED:
            raise TicketError("Só ingressos reservados podem ser confirmados.", 409)
        ticket.status = TicketStatus.CONFIRMED
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def cancel(self, ticket_id: str) -> Ticket:
        ticket = self._lock_ticket(ticket_id)
        batch = self._lock_batch(ticket.batch_id)
        self.db.refresh(ticket)
        if ticket.status == TicketStatus.USED:
            raise TicketError("Ingresso já utilizado não pode ser cancelado.", 409)
        if ticket.status == TicketStatus.CANCELLED:
            return ticket
        ticket.status = TicketStatus.CANCELLED
        ticket.cancelled_at = datetime.now(timezone.utc)
        batch.tickets_sold = max(0, batch.tickets_sold - 1)
        self._sync_status(batch)
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def check_in(self, code: str, user_id: str):
        code = code.strip().upper().replace(" ", "").replace("-", "")
        now = datetime.now(timezone.utc)
        result = self.db.execute(
            update(Ticket)
            .where(Ticket.code == code, Ticket.status == TicketStatus.CONFIRMED)
            .values(status=TicketStatus.USED, used_at=now, checked_in_by_id=user_id)
            .returning(Ticket.id)
        ).first()
        self.db.commit()

        ticket = (
            self.db.query(Ticket)
            .options(joinedload(Ticket.batch).joinedload(TicketBatch.production))
            .filter(Ticket.code == code)
            .first()
        )
        if ticket is None:
            raise TicketError("Código não encontrado.", 404)
        if result is None:
            if ticket.status == TicketStatus.USED:
                when = local_time(ticket.used_at).strftime("%d/%m %H:%M") if ticket.used_at else "antes"
                raise TicketError(f"Ingresso já utilizado ({when}).", 409)
            if ticket.status == TicketStatus.CANCELLED:
                raise TicketError("Ingresso cancelado.", 409)
            if ticket.status == TicketStatus.RESERVED:
                raise TicketError("Ingresso apenas reservado: confirme o pagamento antes da entrada.", 409)
        return ticket

    # ── Resumo ─────────────────────────────────────────────────────────────
    def summary(self, production_id: str) -> dict:
        batches = self.list_batches(production_id)
        batch_ids = [b.id for b in batches]
        revenue = Decimal("0")
        checked_in = 0
        if batch_ids:
            revenue = (
                self.db.query(func.coalesce(func.sum(Ticket.price_paid), 0))
                .filter(Ticket.batch_id.in_(batch_ids), Ticket.status.in_(PAID))
                .scalar()
            )
            checked_in = (
                self.db.query(func.count(Ticket.id))
                .filter(Ticket.batch_id.in_(batch_ids), Ticket.status == TicketStatus.USED)
                .scalar()
            )
        seats = sum(b.total_seats for b in batches if b.status != TicketBatchStatus.CANCELLED)
        sold = sum(b.tickets_sold for b in batches if b.status != TicketBatchStatus.CANCELLED)
        now = datetime.now(timezone.utc)
        return {
            "production_id": production_id,
            "total_batches": len(batches),
            "total_seats": seats,
            "total_sold": sold,
            "total_checked_in": checked_in,
            "total_revenue": revenue,
            "occupancy_rate": round(sold / seats * 100, 1) if seats else 0.0,
            "upcoming_performances": [b for b in batches if b.performance_date >= now],
        }
