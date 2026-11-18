"""Companhias teatrais (cadastro organizacional, sem separação de acesso)."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user, require_roles
from app.core.permissions import COMPANY_WRITE
from app.models.company import Company
from app.models.production import Production
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate

router = APIRouter()


def _with_count(db: Session, company: Company) -> CompanyResponse:
    count = db.query(func.count(Production.id)).filter(Production.company_id == company.id).scalar()
    return CompanyResponse.model_validate(company).model_copy(update={"production_count": count})


def _get(db: Session, company_id: str) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Companhia não encontrada.")
    return company


def _save(db: Session, company: Company):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Já existe uma companhia com esse nome.")
    db.refresh(company)


@router.get("", response_model=List[CompanyResponse])
def list_companies(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    counts = dict(
        db.query(Production.company_id, func.count(Production.id))
        .filter(Production.company_id.isnot(None)).group_by(Production.company_id).all()
    )
    return [
        CompanyResponse.model_validate(c).model_copy(update={"production_count": counts.get(c.id, 0)})
        for c in db.query(Company).order_by(Company.name).all()
    ]


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(company_id: str, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_active_user)):
    return _with_count(db, _get(db, company_id))


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(*COMPANY_WRITE))):
    data = payload.model_dump()
    data["name"] = data["name"].strip()
    company = Company(**data)
    db.add(company)
    _save(db, company)
    return _with_count(db, company)


@router.patch("/{company_id}", response_model=CompanyResponse)
def update_company(company_id: str, payload: CompanyUpdate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(*COMPANY_WRITE))):
    company = _get(db, company_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "name" and value is None:
            continue
        setattr(company, key, value.strip() if key == "name" else value)
    _save(db, company)
    return _with_count(db, company)


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(company_id: str, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(*COMPANY_WRITE))):
    """As produções da companhia continuam existindo, apenas sem companhia."""
    company = _get(db, company_id)
    db.delete(company)
    db.commit()
