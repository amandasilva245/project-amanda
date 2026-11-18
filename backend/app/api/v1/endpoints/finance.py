from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from datetime import date

from app.core.database import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.core.permissions import FINANCE_WRITE, FINANCE_GLOBAL, FINANCE_DELETE
from app.models.user import User, UserRole
from app.models.financial import FinancialTransaction, TransactionCategory, TransactionType
from app.models.production import Production
from app.schemas.financial import (
    TransactionCreate, TransactionUpdate, TransactionResponse, FinancialSummary, check_category,
)
from app.services.financial_service import FinancialService

router = APIRouter()

WRITE_ROLES = FINANCE_WRITE


@router.get("/summary/{production_id}", response_model=FinancialSummary)
def get_financial_summary(
    production_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    service = FinancialService(db)
    summary = service.get_production_summary(production_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Produção não encontrada.")
    return FinancialSummary(**summary)


@router.get("/cashflow/{production_id}")
def get_cashflow(
    production_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    if not db.query(Production.id).filter(Production.id == production_id).first():
        raise HTTPException(status_code=404, detail="Produção não encontrada.")
    service = FinancialService(db)
    return service.get_monthly_cashflow(production_id)


@router.get("/global")
def get_global_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_GLOBAL)),
):
    service = FinancialService(db)
    return service.get_global_insights()


@router.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(
    production_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    category: Optional[TransactionCategory] = Query(None),
    is_reconciled: Optional[bool] = Query(None, description="RF21: filtrar conciliados/pendentes"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    query = db.query(FinancialTransaction).options(
        joinedload(FinancialTransaction.created_by), joinedload(FinancialTransaction.production),
    )
    if production_id:
        query = query.filter(FinancialTransaction.production_id == production_id)
    if type:
        try:
            t = TransactionType(type)
            query = query.filter(FinancialTransaction.type == t)
        except ValueError:
            raise HTTPException(status_code=400, detail="Tipo de lançamento inválido.")
    if category:
        query = query.filter(FinancialTransaction.category == category)
    if is_reconciled is not None:
        query = query.filter(FinancialTransaction.is_reconciled.is_(is_reconciled))
    if date_from:
        query = query.filter(FinancialTransaction.date >= date_from)
    if date_to:
        query = query.filter(FinancialTransaction.date <= date_to)

    transactions = (
        query.order_by(FinancialTransaction.date.desc(), FinancialTransaction.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [TransactionResponse.model_validate(t) for t in transactions]


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    if not db.query(Production.id).filter(Production.id == payload.production_id).first():
        raise HTTPException(status_code=404, detail="Produção não encontrada.")
    transaction = FinancialTransaction(
        **payload.model_dump(),
        created_by_id=current_user.id,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return TransactionResponse.model_validate(transaction)


@router.patch("/transactions/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    transaction = db.query(FinancialTransaction).filter(FinancialTransaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")

    changes = payload.model_dump(exclude_none=True)
    try:
        check_category(transaction.type, changes.get("category", transaction.category))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    for field, value in changes.items():
        setattr(transaction, field, value)
    db.commit()
    db.refresh(transaction)
    return TransactionResponse.model_validate(transaction)


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_DELETE)),
):
    transaction = db.query(FinancialTransaction).filter(FinancialTransaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    db.delete(transaction)
    db.commit()
