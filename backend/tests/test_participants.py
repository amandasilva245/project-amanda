from app.models.user import UserRole


def _add(client, headers, prod_id, user_id, **extra):
    body = {"user_id": user_id, "role_title": "Ofélia", "department": "cast", **extra}
    return client.post(f"/api/v1/productions/{prod_id}/participants", json=body, headers=headers)


def test_editar_e_remover_participante(client, admin, make_user, production):
    _, headers = admin
    ator, _ = make_user(UserRole.ACTOR)
    res = _add(client, headers, production["id"], ator.id, fee="1500")
    assert res.status_code == 201
    part = res.json()
    assert part["is_lead"] is False

    url = f"/api/v1/productions/{production['id']}/participants/{part['id']}"
    res = client.patch(url, json={"is_lead": True, "is_confirmed": True, "fee_paid": "500"}, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["is_lead"] and body["is_confirmed"] and float(body["fee_paid"]) == 500

    # Pagamento acima do cachê é recusado
    assert client.patch(url, json={"fee_paid": "2000"}, headers=headers).status_code == 422

    assert client.delete(url, headers=headers).status_code == 204
    assert client.patch(url, json={"is_lead": False}, headers=headers).status_code == 404


def test_mesma_pessoa_com_varias_funcoes(client, admin, make_user, production):
    """Pesquisa de campo (§4.7): membros acumulam funções numa mesma produção."""
    _, headers = admin
    pessoa, _ = make_user(UserRole.ACTOR)
    assert _add(client, headers, production["id"], pessoa.id).status_code == 201
    assert _add(client, headers, production["id"], pessoa.id, role_title="Figurinista",
                department="technical").status_code == 201
    metrics = client.get("/api/v1/insights/dashboard", headers=headers).json()
    assert metrics["total_cast_members"] == 1  # pessoa contada uma vez


def test_validacoes_de_participante(client, admin, make_user, production):
    _, headers = admin
    ator, _ = make_user(UserRole.ACTOR)
    assert _add(client, headers, production["id"], ator.id, fee="-1").status_code == 422
    assert _add(client, headers, production["id"], ator.id,
                start_date="2026-05-10", end_date="2026-05-01").status_code == 422
    assert _add(client, headers, production["id"], "nao-existe").status_code == 422


def test_ator_nao_edita_participantes(client, admin, make_user, production):
    _, headers = admin
    ator, ator_headers = make_user(UserRole.ACTOR)
    part = _add(client, headers, production["id"], ator.id).json()
    url = f"/api/v1/productions/{production['id']}/participants/{part['id']}"
    assert client.patch(url, json={"is_lead": True}, headers=ator_headers).status_code == 403


def test_validacoes_de_producao(client, admin, production):
    _, headers = admin
    url = f"/api/v1/productions/{production['id']}"
    assert client.patch(url, json={"end_date": "2020-01-01", "start_date": "2021-01-01"}, headers=headers).status_code == 422
    assert client.patch(url, json={"venue_capacity": 0}, headers=headers).status_code == 422
    assert client.patch(url, json={"color_accent": "dourado"}, headers=headers).status_code == 422
    assert client.post("/api/v1/productions", json={"title": ""}, headers=headers).status_code == 422
