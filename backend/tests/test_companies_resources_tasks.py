from app.models.user import UserRole

C, R, TK = "/api/v1/companies", "/api/v1/resources", "/api/v1/tasks"


def test_companhia_crud_e_vinculo_com_producao(client, admin, production):
    _, h = admin
    res = client.post(C, json={"name": "Cia. Lanterna Mágica", "city": "São Paulo", "founded_year": 2009,
                               "responsible_name": "Helena Prado", "email": ""}, headers=h)
    assert res.status_code == 201, res.text
    cid = res.json()["id"]
    assert client.post(C, json={"name": "Cia. Lanterna Mágica"}, headers=h).status_code == 409

    upd = client.patch(f"/api/v1/productions/{production['id']}",
                       json={"company_id": cid, "duration_minutes": 95}, headers=h)
    assert upd.status_code == 200 and upd.json()["company"]["name"] == "Cia. Lanterna Mágica"
    assert upd.json()["duration_minutes"] == 95
    assert client.get(C, headers=h).json()[0]["production_count"] == 1
    listed = client.get("/api/v1/productions", params={"company_id": cid}, headers=h).json()
    assert listed["total"] == 1

    assert client.patch(f"/api/v1/productions/{production['id']}", json={"company_id": "nao-existe"},
                        headers=h).status_code == 422
    # Sem companhia de novo
    assert client.patch(f"/api/v1/productions/{production['id']}", json={"company_id": ""},
                        headers=h).json()["company_id"] is None

    # Excluir a companhia não apaga a produção
    client.patch(f"/api/v1/productions/{production['id']}", json={"company_id": cid}, headers=h)
    assert client.delete(f"{C}/{cid}", headers=h).status_code == 204
    assert client.get(f"/api/v1/productions/{production['id']}", headers=h).json()["company_id"] is None


def test_companhia_so_admin_e_produtor_alteram(client, make_user):
    _, h = make_user(UserRole.DIRECTOR)
    assert client.post(C, json={"name": "Cia X"}, headers=h).status_code == 403
    assert client.get(C, headers=h).status_code == 200


def test_recursos_custos_e_filtros(client, admin, production):
    _, h = admin
    body = {"production_id": production["id"], "name": "Vestido de Ofélia", "type": "costume",
            "quantity": 2, "unit_cost": "850.00", "status": "in_progress"}
    r = client.post(R, json=body, headers=h)
    assert r.status_code == 201, r.text
    assert float(r.json()["total_cost"]) == 1700.0 and r.json()["production_title"] == "Hamlet"
    client.post(R, json={**body, "name": "Mesa de luz", "type": "equipment", "quantity": 1, "unit_cost": None},
                headers=h)
    assert len(client.get(R, params={"type": "costume"}, headers=h).json()) == 1
    assert len(client.get(R, params={"search": "mesa"}, headers=h).json()) == 1
    rid = r.json()["id"]
    assert client.patch(f"{R}/{rid}", json={"status": "available"}, headers=h).json()["status"] == "available"
    assert client.post(R, json={**body, "quantity": 0}, headers=h).status_code == 422
    assert client.delete(f"{R}/{rid}", headers=h).status_code == 204


def test_recursos_visiveis_so_para_participantes(client, admin, production, make_user):
    _, h = admin
    client.post(R, json={"production_id": production["id"], "name": "Trono", "type": "set"}, headers=h)
    tech, th = make_user(UserRole.TECHNICIAN)
    assert client.get(R, headers=th).json() == []
    assert client.post(R, json={"production_id": production["id"], "name": "Refletor", "type": "equipment"},
                       headers=th).status_code == 403
    client.post(f"/api/v1/productions/{production['id']}/participants",
                json={"user_id": tech.id, "role_title": "Iluminador", "department": "technical"}, headers=h)
    assert len(client.get(R, headers=th).json()) == 1
    assert client.post(R, json={"production_id": production["id"], "name": "Refletor", "type": "equipment"},
                       headers=th).status_code == 201
    _, ah = make_user(UserRole.ACTOR)
    assert client.post(R, json={"production_id": production["id"], "name": "Caveira", "type": "prop"},
                       headers=ah).status_code == 403


def test_tarefas_fluxo_e_permissoes(client, admin, production, make_user):
    _, h = admin
    actor, ah = make_user(UserRole.ACTOR)
    client.post(f"/api/v1/productions/{production['id']}/participants",
                json={"user_id": actor.id, "role_title": "Hamlet", "department": "cast"}, headers=h)
    t = client.post(TK, json={"production_id": production["id"], "title": "Decorar o 3º ato",
                              "assignee_id": actor.id, "due_date": "2020-01-01", "priority": "high"}, headers=h)
    assert t.status_code == 201, t.text
    task = t.json()
    assert task["overdue"] is True and task["assignee"]["full_name"]

    # O ator não cria, mas atualiza o andamento da própria tarefa
    assert client.post(TK, json={"production_id": production["id"], "title": "Ensaiar"}, headers=ah).status_code == 403
    assert client.patch(f"{TK}/{task['id']}", json={"title": "outro"}, headers=ah).status_code == 403
    done = client.patch(f"{TK}/{task['id']}", json={"status": "done"}, headers=ah).json()
    assert done["status"] == "done" and done["completed_at"] and done["overdue"] is False
    assert len(client.get(TK, params={"mine": True}, headers=ah).json()) == 1

    # Quem não participa não vê
    _, oh = make_user(UserRole.ACTOR)
    assert client.get(TK, headers=oh).json() == []
    assert client.delete(f"{TK}/{task['id']}", headers=h).status_code == 204
