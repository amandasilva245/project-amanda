"""Infraestrutura de testes.

Os testes rodam contra um PostgreSQL de TESTE, indicado em TEST_DATABASE_URL
(nunca o banco de desenvolvimento ou produção: todas as tabelas são
esvaziadas entre os testes). Exemplo:

    TEST_DATABASE_URL=postgresql://curtain_user:senha@localhost:5432/curtain_test pytest

Sem TEST_DATABASE_URL a suíte é pulada.
"""

import os
import sys

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
if not TEST_DB:
    pytest.skip("Defina TEST_DATABASE_URL para rodar os testes.", allow_module_level=True)
if not TEST_DB.rstrip("/").split("/")[-1].endswith("test"):
    raise RuntimeError("Por segurança, o nome do banco em TEST_DATABASE_URL deve terminar em 'test'.")

os.environ["DATABASE_URL"] = TEST_DB
os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("SECRET_KEY", "chave-apenas-para-testes")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core import rate_limit  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from migrate import migrate  # noqa: E402

PASSWORD = "Senha123"
_HASH = None


@pytest.fixture(scope="session", autouse=True)
def _schema():
    migrate()
    yield


@pytest.fixture(autouse=True)
def _clean_db():
    yield
    tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    rate_limit.reset_all()


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def make_user(db):
    """Cria um usuário com o papel pedido e devolve (user, headers)."""
    global _HASH
    if _HASH is None:
        _HASH = hash_password(PASSWORD)

    counter = {"n": 0}

    def _make(role: UserRole = UserRole.ADMIN, active: bool = True, name: str | None = None):
        counter["n"] += 1
        user = User(
            email=f"{role.value}{counter['n']}@teste.curtain",
            hashed_password=_HASH,
            full_name=name or f"{role.value.title()} {counter['n']}",
            role=role,
            is_active=active,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        from app.core.security import create_access_token
        return user, {"Authorization": f"Bearer {create_access_token(user.id)}"}

    return _make


@pytest.fixture
def admin(make_user):
    return make_user(UserRole.ADMIN)


@pytest.fixture
def production(client, admin):
    _, headers = admin
    res = client.post("/api/v1/productions", json={
        "title": "Hamlet", "genre": "drama", "venue": "Teatro Municipal",
        "venue_capacity": 300, "budget_total": "50000",
    }, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()
