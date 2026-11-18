from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging

from app.core import rate_limit
from app.core.database import get_db
from app.core.permissions import PEOPLE_DIRECTORY
from app.core.privacy import mask_email
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token, hash_password
from app.core.dependencies import get_current_active_user, require_admin, require_roles
from app.models.user import User
from app.schemas.user import (
    LoginRequest, TokenResponse, UserCreate, UserResponse, UserUpdate, UserAdminUpdate,
    PasswordChange, RefreshRequest, UserDirectoryEntry,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown"
    limiter_key = f"{client_ip}:{email}"
    if rate_limit.is_blocked(limiter_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Tente novamente em 15 minutos.",
        )
    try:
        user = db.query(User).filter(User.email.ilike(email), User.is_active == True).first()
        if not user or not verify_password(payload.password, user.hashed_password):
            rate_limit.register_failure(limiter_key)
            logger.warning("Falha de login para %s", mask_email(email))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail ou senha incorretos.",
            )

        rate_limit.reset(limiter_key)
        user.last_login = datetime.now(timezone.utc)
        db.commit()

        return TokenResponse(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
            user=UserResponse.model_validate(user),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Erro interno do servidor. Tente novamente.")


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    body: Optional[RefreshRequest] = None,
    refresh_token: Optional[str] = None,  # compatibilidade: ?refresh_token=...
    db: Session = Depends(get_db),
):
    token = (body.refresh_token if body else None) or refresh_token
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada. Entre novamente.")
    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada. Entre novamente.")

    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Pessoa não encontrada.")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Troca a senha do próprio usuário, exigindo a senha atual."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta.")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()


@router.get("/directory", response_model=list[UserDirectoryEntry])
def list_directory(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PEOPLE_DIRECTORY)),
):
    """Pessoas ativas, com dados mínimos, para quem monta elencos (admin, produção, direção)."""
    return db.query(User).filter(User.is_active == True).order_by(User.full_name).all()


@router.post("/users", response_model=UserResponse, dependencies=[Depends(require_admin)])
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email.ilike(payload.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma pessoa cadastrada com esse e-mail.")

    user = User(
        email=payload.email.strip().lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        bio=payload.bio,
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserResponse], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
def update_user(
    user_id: str,
    payload: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pessoa não encontrada.")
    # Impede que o admin se tranque fora do sistema
    if user.id == current_user.id and (payload.is_active is False or (payload.role and payload.role != user.role)):
        raise HTTPException(status_code=400, detail="Você não pode desativar nem rebaixar a própria conta.")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
