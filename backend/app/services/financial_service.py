from decimal import Decimal
from typing import List, Optional, Dict, Any
from datetime import date, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.production import Production, ProductionParticipant, ProductionStatus
from app.models.financial import FinancialTransaction, TransactionType, TransactionCategory
from app.models.ticket import TicketBatch, Ticket, TicketStatus


class FinancialService:
    def __init__(self, db: Session):
        self.db = db

    def get_production_summary(self, production_id: str) -> Dict[str, Any]:
        production = self.db.query(Production).filter(Production.id == production_id).first()
        if not production:
            return {}

        transactions = (
            self.db.query(FinancialTransaction)
            .filter(FinancialTransaction.production_id == production_id)
            .all()
        )

        total_income = sum(t.amount for t in transactions if t.type == TransactionType.INCOME)
        total_expense = sum(t.amount for t in transactions if t.type == TransactionType.EXPENSE)

        income_by_cat: Dict[str, float] = defaultdict(float)
        expense_by_cat: Dict[str, float] = defaultdict(float)

        for t in transactions:
            if t.type == TransactionType.INCOME:
                income_by_cat[t.category.value] += float(t.amount)
            else:
                expense_by_cat[t.category.value] += float(t.amount)

        budget_used_pct = None
        if production.budget_total and float(production.budget_total) > 0:
            budget_used_pct = round(float(total_expense) / float(production.budget_total) * 100, 1)

        return {
            "production_id": production_id,
            "total_income": total_income,
            "total_expense": total_expense,
            "net_balance": total_income - total_expense,
            "budget_total": production.budget_total,
            "budget_used_pct": budget_used_pct,
            "income_by_category": dict(income_by_cat),
            "expense_by_category": dict(expense_by_cat),
        }

    def get_monthly_cashflow(self, production_id: str) -> List[Dict]:
        transactions = (
            self.db.query(FinancialTransaction)
            .filter(FinancialTransaction.production_id == production_id)
            .order_by(FinancialTransaction.date)
            .all()
        )

        monthly: Dict[str, Dict] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
        for t in transactions:
            key = t.date.strftime("%Y-%m")
            if t.type == TransactionType.INCOME:
                monthly[key]["income"] += float(t.amount)
            else:
                monthly[key]["expense"] += float(t.amount)

        return [{"month": k, **v} for k, v in sorted(monthly.items())]

    def get_global_insights(self) -> Dict[str, Any]:
        """Platform-wide financial analytics."""
        total_income = self.db.query(
            func.sum(FinancialTransaction.amount)
        ).filter(FinancialTransaction.type == TransactionType.INCOME).scalar() or Decimal("0")

        total_expense = self.db.query(
            func.sum(FinancialTransaction.amount)
        ).filter(FinancialTransaction.type == TransactionType.EXPENSE).scalar() or Decimal("0")

        top_productions = (
            self.db.query(
                Production.id,
                Production.title,
                func.sum(FinancialTransaction.amount).label("revenue"),
            )
            .join(FinancialTransaction, FinancialTransaction.production_id == Production.id)
            .filter(FinancialTransaction.type == TransactionType.INCOME)
            .group_by(Production.id, Production.title)
            .order_by(func.sum(FinancialTransaction.amount).desc())
            .limit(5)
            .all()
        )

        return {
            "total_income": float(total_income),
            "total_expense": float(total_expense),
            "net_balance": float(total_income - total_expense),
            "top_productions": [
                {"id": p.id, "title": p.title, "revenue": float(p.revenue)}
                for p in top_productions
            ],
        }


class InsightService:
    def __init__(self, db: Session):
        self.db = db

    def get_dashboard_metrics(self, user_id: str) -> Dict[str, Any]:
        active_productions = (
            self.db.query(func.count(Production.id))
            .filter(Production.status.in_([
                ProductionStatus.PRE_PRODUCTION,
                ProductionStatus.REHEARSAL,
                ProductionStatus.PERFORMANCE,
            ]))
            .scalar()
        )

        total_cast = (
            self.db.query(func.count(ProductionParticipant.id)).scalar()
        )

        ticket_revenue = (
            self.db.query(func.sum(Ticket.price_paid))
            .filter(Ticket.status != TicketStatus.CANCELLED)
            .scalar() or Decimal("0")
        )

        total_tickets_sold = (
            self.db.query(func.count(Ticket.id))
            .filter(Ticket.status.in_([TicketStatus.CONFIRMED, TicketStatus.USED]))
            .scalar()
        )

        return {
            "active_productions": active_productions,
            "total_cast_members": total_cast,
            "ticket_revenue": float(ticket_revenue),
            "total_tickets_sold": total_tickets_sold,
        }

    def get_occupancy_trends(self) -> List[Dict]:
        batches = (
            self.db.query(TicketBatch)
            .filter(TicketBatch.total_seats > 0)
            .order_by(TicketBatch.performance_date)
            .limit(20)
            .all()
        )
        return [
            {
                "date": b.performance_date.strftime("%Y-%m-%d"),
                "occupancy": round(b.tickets_sold / b.total_seats * 100, 1),
                "revenue": float(b.price) * b.tickets_sold,
            }
            for b in batches
        ]
