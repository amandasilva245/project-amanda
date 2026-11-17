"""Matriz papel × rota (RNF03): quem não pode recebe 403."""

import pytest

from app.models.user import UserRole as R

ALL = set(R)

# (método, rota, papéis autorizados)
MATRIX = [
    ("get", "/api/v1/auth/users", {R.ADMIN}),
    ("get", "/api/v1/auth/directory", {R.ADMIN, R.PRODUCER, R.DIRECTOR}),
    ("get", "/api/v1/finance/global", {R.ADMIN, R.PRODUCER, R.FINANCIAL_MANAGER}),
    ("get", "/api/v1/finance/transactions", {R.ADMIN, R.PRODUCER, R.FINANCIAL_MANAGER}),
    ("get", "/api/v1/insights/occupancy-trends", {R.ADMIN, R.PRODUCER, R.FINANCIAL_MANAGER, R.DIRECTOR}),
    ("get", "/api/v1/insights/dashboard", ALL),
    ("get", "/api/v1/productions", ALL),
]


@pytest.mark.parametrize("method,url,allowed", MATRIX, ids=[m[1] for m in MATRIX])
@pytest.mark.parametrize("role", list(R), ids=[r.value for r in R])
def test_matriz_de_permissoes(client, make_user, method, url, allowed, role):
    _, headers = make_user(role)
    res = getattr(client, method)(url, headers=headers)
    if role in allowed:
        assert res.status_code == 200, res.text
    else:
        assert res.status_code == 403, res.text


def test_sem_token_recebe_401_ou_403(client):
    assert client.get("/api/v1/productions").status_code in (401, 403)
