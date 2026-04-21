from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.services.financial_service import InsightService

router = APIRouter()


@router.get("/dashboard")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = InsightService(db)
    return service.get_dashboard_metrics(current_user.id)


@router.get("/occupancy-trends")
def get_occupancy_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = InsightService(db)
    return service.get_occupancy_trends()
