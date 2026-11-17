from app.models.user import UserRole


def test_crud_de_producao(client, admin, production):
    _, headers = admin
    pid = production["id"]
    assert production["slug"] == "hamlet"

    res = client.patch(f"/api/v1/productions/{pid}", json={"status": "rehearsal", "venue": "Sala 2"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "rehearsal"

    lista = client.get("/api/v1/productions", params={"status": "rehearsal", "search": "ham"}, headers=headers).json()
    assert lista["total"] == 1

    assert client.delete(f"/api/v1/productions/{pid}", headers=headers).status_code == 204
    assert client.get(f"/api/v1/productions/{pid}", headers=headers).status_code == 404


def test_slug_unico(client, admin):
    _, headers = admin
    a = client.post("/api/v1/productions", json={"title": "Medeia"}, headers=headers).json()
    b = client.post("/api/v1/productions", json={"title": "Medeia"}, headers=headers).json()
    assert a["slug"] != b["slug"]


def test_ator_ve_somente_as_proprias_producoes(client, admin, make_user, production):
    _, admin_headers = admin
    outra = client.post("/api/v1/productions", json={"title": "Outra peça"}, headers=admin_headers).json()
    ator, ator_headers = make_user(UserRole.ACTOR)
    client.post(f"/api/v1/productions/{production['id']}/participants", json={
        "user_id": ator.id, "role_title": "Hamlet", "department": "cast",
    }, headers=admin_headers)

    lista = client.get("/api/v1/productions", headers=ator_headers).json()
    assert [p["id"] for p in lista["items"]] == [production["id"]]
    # Filtros continuam valendo para o ator
    assert client.get("/api/v1/productions", params={"search": "zzz"}, headers=ator_headers).json()["total"] == 0
    assert client.get(f"/api/v1/productions/{outra['id']}", headers=ator_headers).status_code == 403


def test_ator_nao_cria_producao(client, make_user):
    _, headers = make_user(UserRole.ACTOR)
    assert client.post("/api/v1/productions", json={"title": "X"}, headers=headers).status_code == 403


def test_status_invalido(client, admin):
    _, headers = admin
    assert client.get("/api/v1/productions", params={"status": "xyz"}, headers=headers).status_code == 400
