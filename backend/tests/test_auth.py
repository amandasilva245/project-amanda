from app.models.user import UserRole
from tests.conftest import PASSWORD


def login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_login_devolve_tokens_e_registra_ultimo_acesso(client, make_user, db):
    user, _ = make_user(UserRole.PRODUCER)
    res = login(client, user.email.upper())  # e-mail sem diferenciar maiúsculas
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"] and body["refresh_token"]
    db.refresh(user)
    assert user.last_login is not None


def test_login_com_senha_errada_e_conta_inativa(client, make_user):
    user, _ = make_user(UserRole.ACTOR)
    assert login(client, user.email, "Errada123").status_code == 401
    inativo, _ = make_user(UserRole.ACTOR, active=False)
    assert login(client, inativo.email).status_code == 401


def test_limite_de_tentativas_de_login(client, make_user):
    user, _ = make_user(UserRole.ACTOR)
    for _ in range(5):
        assert login(client, user.email, "Errada123").status_code == 401
    # Bloqueado mesmo com a senha certa até a janela expirar
    assert login(client, user.email).status_code == 429


def test_refresh_por_corpo_json_e_por_query(client, make_user):
    user, _ = make_user(UserRole.ACTOR)
    refresh = login(client, user.email).json()["refresh_token"]
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh}).status_code == 200
    assert client.post(f"/api/v1/auth/refresh?refresh_token={refresh}").status_code == 200
    access = login(client, user.email).json()["access_token"]
    # Token de acesso não serve como refresh
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": access}).status_code == 401


def test_refresh_token_nao_serve_como_acesso(client, make_user):
    user, _ = make_user(UserRole.ACTOR)
    refresh = login(client, user.email).json()["refresh_token"]
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh}"})
    assert res.status_code == 401


def test_troca_de_senha(client, make_user):
    user, headers = make_user(UserRole.ACTOR)
    url = "/api/v1/auth/me/password"
    assert client.post(url, json={"current_password": "Errada123", "new_password": "NovaSenha9"}, headers=headers).status_code == 400
    assert client.post(url, json={"current_password": PASSWORD, "new_password": "fraca"}, headers=headers).status_code == 422
    assert client.post(url, json={"current_password": PASSWORD, "new_password": "NovaSenha9"}, headers=headers).status_code == 204
    assert login(client, user.email, "NovaSenha9").status_code == 200


def test_admin_nao_se_desativa(client, admin):
    user, headers = admin
    res = client.patch(f"/api/v1/auth/users/{user.id}", json={"is_active": False}, headers=headers)
    assert res.status_code == 400


def test_diretorio_de_pessoas_sem_dados_sensiveis(client, make_user):
    _, headers = make_user(UserRole.DIRECTOR)
    res = client.get("/api/v1/auth/directory", headers=headers)
    assert res.status_code == 200
    assert "phone" not in res.json()[0]
