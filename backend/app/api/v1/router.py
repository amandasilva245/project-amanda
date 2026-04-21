from fastapi import APIRouter

from app.api.v1.endpoints import auth, productions, finance, insights

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(productions.router, prefix="/productions", tags=["productions"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
