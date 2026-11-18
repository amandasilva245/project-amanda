"""Informações do sistema para a tela de Configurações (TCC §4.2)."""

import platform
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User, UserRole

router = APIRouter()


@router.get("/info")
def system_info(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    database = "ok"
    revision = None
    try:
        db.execute(text("SELECT 1"))
        try:
            revision = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        except Exception:
            db.rollback()
    except Exception:
        database = "indisponível"

    info = {
        "demo": settings.DEMO_MODE,
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "api": "ok",
        "database": database,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }
    # Detalhes de infraestrutura só para administradores
    if current_user.role == UserRole.ADMIN:
        info.update({
            "environment": settings.ENVIRONMENT,
            "migration": revision,
            "python": platform.python_version(),
            "docs_enabled": settings.ENVIRONMENT != "production",
        })
    return info


# Contas de demonstração exibidas na tela de login (só em DEMO_MODE; nunca a senha)
DEMO_ACCOUNTS = [
    {"email": "admin@curtain.example", "role": "admin", "name": "Beatriz Valença"},
    {"email": "producao@curtain.example", "role": "producer", "name": "Otávio Rangel"},
    {"email": "financeiro@curtain.example", "role": "financial_manager", "name": "Lúcia Fontoura"},
    {"email": "direcao@curtain.example", "role": "director", "name": "Helena Prado"},
    {"email": "tecnica@curtain.example", "role": "technician", "name": "Rafaela Couto"},
    {"email": "elenco@curtain.example", "role": "actor", "name": "Caio Albuquerque"},
]


@router.get("/mode")
def system_mode():
    """Público: diz se este é o ambiente de demonstração (para o aviso na tela)."""
    return {"demo": settings.DEMO_MODE, "accounts": DEMO_ACCOUNTS if settings.DEMO_MODE else []}
