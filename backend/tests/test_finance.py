from app.models.user import UserRole

TX = "/api/v1/finance/transactions"


def _tx(production_id, **extra):
    body = {"production_id": production_id, "type": "expense", "category": "costumes", "amount": "1200.50",
            "description": "Tecido do figurino", "date": "2026-11-10", "reference_code": "NF-0042"}
    body.update(extra)
    return body


def test_lancamento_e_resumo_da_producao(client, admin, production):
    _, headers = admin
    pid = production["id"]
    assert client.post(TX, json=_tx(pid), headers=headers).status_code == 201
    assert client.post(TX, json=_tx(pid, type="income", category="sponsorship", amount="5000",
                                    date="2026-12-02", description="Patrocínio"), headers=headers).status_code == 201

    s = client.get(f"/api/v1/finance/summary/{pid}", headers=headers).json()
    assert float(s["total_income"]) == 5000 and float(s["total_expense"]) == 1200.5
    assert float(s["net_balance"]) == 3799.5
    assert s["budget_used_pct"] == 2.4  # 1200,50 de 50.000
    assert s["expense_by_category"] == {"costumes": 1200.5}

    flow = client.get(f"/api/v1/finance/cashflow/{pid}", headers=headers).json()
    assert [m["month"] for m in flow] == ["2026-11", "2026-12"]
    assert client.get("/api/v1/finance/cashflow/nao-existe", headers=headers).status_code == 404


def test_validacoes_de_lancamento(client, admin, production):
    _, headers = admin
    pid = production["id"]
    assert client.post(TX, json=_tx(pid, amount="0"), headers=headers).status_code == 422
    assert client.post(TX, json=_tx(pid, amount="-10"), headers=headers).status_code == 422
    # Categoria de despesa numa receita
    assert client.post(TX, json=_tx(pid, type="income", category="costumes"), headers=headers).status_code == 422
    assert client.post(TX, json=_tx(pid, description=""), headers=headers).status_code == 422
    assert client.post(TX, json=_tx("nao-existe"), headers=headers).status_code == 404


def test_conciliacao_e_filtros(client, admin, production):
    _, headers = admin
    pid = production["id"]
    a = client.post(TX, json=_tx(pid), headers=headers).json()
    client.post(TX, json=_tx(pid, type="income", category="donation", description="Doação"), headers=headers)

    res = client.patch(f"{TX}/{a['id']}", json={"is_reconciled": True}, headers=headers)
    assert res.status_code == 200 and res.json()["is_reconciled"] is True

    pend = client.get(TX, params={"is_reconciled": False}, headers=headers).json()
    assert [t["description"] for t in pend] == ["Doação"]
    assert len(client.get(TX, params={"production_id": pid, "type": "expense"}, headers=headers).json()) == 1
    assert len(client.get(TX, params={"category": "donation"}, headers=headers).json()) == 1
    assert client.get(TX, headers=headers).json()[0]["production"]["title"] == "Hamlet"

    # Trocar para categoria incompatível com o tipo é recusado
    assert client.patch(f"{TX}/{a['id']}", json={"category": "grant"}, headers=headers).status_code == 422


def test_produtor_lanca_mas_nao_exclui(client, make_user, admin, production):
    _, headers = make_user(UserRole.PRODUCER)
    tx = client.post(TX, json=_tx(production["id"]), headers=headers).json()
    assert client.delete(f"{TX}/{tx['id']}", headers=headers).status_code == 403
    _, admin_headers = admin
    assert client.delete(f"{TX}/{tx['id']}", headers=admin_headers).status_code == 204


def test_top5_global(client, admin):
    _, headers = admin
    for i in range(6):
        p = client.post("/api/v1/productions", json={"title": f"Peça {i}"}, headers=headers).json()
        client.post(TX, json=_tx(p["id"], type="income", category="ticket_sales", amount=str(100 * (i + 1))), headers=headers)
    top = client.get("/api/v1/finance/global", headers=headers).json()["top_productions"]
    assert len(top) == 5 and top[0]["title"] == "Peça 5"


def test_info_do_sistema(client, admin, make_user):
    _, headers = admin
    info = client.get("/api/v1/system/info", headers=headers).json()
    assert info["database"] == "ok" and info["migration"]
    _, ator = make_user(UserRole.ACTOR)
    assert "environment" not in client.get("/api/v1/system/info", headers=ator).json()


def test_receitas_e_despesas_por_categoria(client, admin, production):
    _, headers = admin
    pid = production["id"]
    client.post(TX, json=_tx(pid), headers=headers)
    client.post(TX, json=_tx(pid, amount="300"), headers=headers)
    client.post(TX, json=_tx(pid, type="income", category="grant", amount="9000"), headers=headers)
    rows = client.get("/api/v1/insights/finance-by-category", headers=headers).json()
    assert rows[0] == {"category": "grant", "income": 9000.0, "expense": 0.0}
    assert rows[1] == {"category": "costumes", "income": 0.0, "expense": 1500.5}
