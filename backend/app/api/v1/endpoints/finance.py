from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date

from app.core.database import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.models.user import User, UserRole
from app.models.financial import FinancialTransaction, TransactionType
from app.schemas.financial import (
    TransactionCreate, TransactionUpdate, TransactionResponse, FinancialSummary,
)
from app.services.financial_service import FinancialService

router = APIRouter()

WRITE_ROLES = (UserRole.ADMIN, UserRole.PRODUCER, UserRole.FINANCIAL_MANAGER)


@router.get("/summary/{production_id}", response_model=FinancialSummary)
def get_financial_summary(
    production_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    service = FinancialService(db)
    summary = service.get_production_summary(production_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Production not found")
    return FinancialSummary(**summary)


@router.get("/cashflow/{production_id}")
def get_cashflow(
    production_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    service = FinancialService(db)
    return service.get_monthly_cashflow(production_id)


@router.get("/global")
def get_global_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FINANCIAL_MANAGER)),
):
    service = FinancialService(db)
    return service.get_global_insights()


@router.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(
    production_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
):
    query = db.query(FinancialTransaction)
    if production_id:
        query = query.filter(FinancialTransaction.production_id == production_id)
    if type:
        try:
            t = TransactionType(type)
            query = query.filter(FinancialTransaction.type == t)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid transaction type")

    transactions = (
        query.order_by(FinancialTransaction.date.desc())
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
        raise HTTPException(status_code=404, detail="Transaction not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(transaction, field, value)
    db.commit()
    db.refresh(transaction)
    return TransactionResponse.model_validate(transaction)


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FINANCIAL_MANAGER)),
):
    transaction = db.query(FinancialTransaction).filter(FinancialTransaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(transaction)
    db.commit()
