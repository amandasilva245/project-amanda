import threading

from fastapi.testclient import TestClient

from app.main import app
from app.models.user import UserRole

T = "/api/v1/tickets"


def _batch(client, headers, production_id, seats=3, **extra):
    body = {"production_id": production_id, "performance_date": "2027-03-10T20:00:00-03:00",
            "total_seats": seats, "price": "60.00", "price_premium": "120.00", "venue_section": "Plateia"}
    body.update(extra)
    res = client.post(f"{T}/batches", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def _sell(client, headers, batch_id, **extra):
    body = {"batch_id": batch_id, "buyer_name": "Maria Souza", "buyer_email": "Maria@Exemplo.com"}
    body.update(extra)
    return client.post(T, json=body, headers=headers)


def test_lote_venda_codigo_unico_e_esgotado(client, admin, production):
    _, h = admin
    batch = _batch(client, h, production["id"], seats=3)
    assert batch["status"] == "on_sale" and batch["available_seats"] == 3

    res = _sell(client, h, batch["id"], quantity=2)
    assert res.status_code == 201
    tickets = res.json()
    codes = {t["code"] for t in tickets}
    assert len(codes) == 2 and all(len(c) == 10 for c in codes)
    assert tickets[0]["buyer_email"] == "maria@exemplo.com"
    assert float(tickets[0]["price_paid"]) == 60.0

    premium = _sell(client, h, batch["id"], is_premium=True).json()[0]
    assert float(premium["price_paid"]) == 120.0

    batches = client.get(f"{T}/batches", params={"production_id": production["id"]}, headers=h).json()
    assert batches[0]["tickets_sold"] == 3 and batches[0]["status"] == "sold_out"
    assert _sell(client, h, batch["id"]).status_code == 409

    # Cancelar devolve o lugar e reabre as vendas
    assert client.post(f"{T}/{premium['id']}/cancel", headers=h).json()["status"] == "cancelled"
    b = client.get(f"{T}/batches", headers=h).json()[0]
    assert b["tickets_sold"] == 2 and b["status"] == "on_sale"


def test_validacoes_de_lote(client, admin, production):
    _, h = admin
    base = {"production_id": production["id"], "performance_date": "2027-03-10T20:00:00-03:00",
            "total_seats": 10, "price": "50"}
    assert client.post(f"{T}/batches", json={**base, "total_seats": 0}, headers=h).status_code == 422
    assert client.post(f"{T}/batches", json={**base, "price": "-1"}, headers=h).status_code == 422
    assert client.post(f"{T}/batches", json={**base, "sale_start": "2027-03-05T00:00:00-03:00",
                                             "sale_end": "2027-03-01T00:00:00-03:00"}, headers=h).status_code == 422
    assert client.post(f"{T}/batches", json={**base, "production_id": "x"}, headers=h).status_code == 404
    batch = _batch(client, h, production["id"], seats=5)
    _sell(client, h, batch["id"], quantity=3)
    # Capacidade abaixo do vendido é recusada
    assert client.patch(f"{T}/batches/{batch['id']}", json={"total_seats": 2}, headers=h).status_code == 409


def test_periodo_de_vendas(client, admin, production):
    _, h = admin
    batch = _batch(client, h, production["id"], sale_start="2026-12-01T00:00:00-03:00",
                   sale_end="2026-12-02T00:00:00-03:00", performance_date="2026-12-03T20:00:00-03:00")
    assert _sell(client, h, batch["id"]).status_code == 409  # fora do período


def test_check_in_atomico(client, admin, make_user, production):
    _, h = admin
    batch = _batch(client, h, production["id"])
    code = _sell(client, h, batch["id"]).json()[0]["code"]
    _, tec = make_user(UserRole.TECHNICIAN)

    res = client.post(f"{T}/check-in", json={"code": code.lower()}, headers=tec)
    assert res.status_code == 200
    body = res.json()
    assert body["ticket"]["status"] == "used" and body["production_title"] == "Hamlet"
    assert body["ticket"]["buyer_email"].startswith("m***@")  # técnico não vê o e-mail
    again = client.post(f"{T}/check-in", json={"code": code}, headers=tec)
    assert again.status_code == 409 and "já utilizado" in again.json()["detail"]
    assert client.post(f"{T}/check-in", json={"code": "NAOEXISTE"}, headers=tec).status_code == 404


def test_reserva_nao_entra_sem_confirmar(client, admin, production):
    _, h = admin
    batch = _batch(client, h, production["id"])
    t = _sell(client, h, batch["id"], status="reserved").json()[0]
    assert client.post(f"{T}/check-in", json={"code": t["code"]}, headers=h).status_code == 409
    assert client.post(f"{T}/{t['id']}/confirm", headers=h).json()["status"] == "confirmed"
    assert client.post(f"{T}/check-in", json={"code": t["code"]}, headers=h).status_code == 200
    # Utilizado não pode ser cancelado
    assert client.post(f"{T}/{t['id']}/cancel", headers=h).status_code == 409


def test_resumo_e_painel(client, admin, production):
    _, h = admin
    batch = _batch(client, h, production["id"], seats=10)
    _sell(client, h, batch["id"], quantity=2)
    _sell(client, h, batch["id"], status="reserved")
    s = client.get(f"{T}/summary/{production['id']}", headers=h).json()
    assert s["total_sold"] == 3 and float(s["total_revenue"]) == 120.0 and s["occupancy_rate"] == 30.0
    m = client.get("/api/v1/insights/dashboard", headers=h).json()
    assert m["total_tickets_sold"] == 2 and m["ticket_revenue"] == 120.0


def test_permissoes(client, admin, make_user, production):
    _, h = admin
    batch = _batch(client, h, production["id"])
    _, ator = make_user(UserRole.ACTOR)
    _, diretor = make_user(UserRole.DIRECTOR)
    assert client.get(f"{T}/batches", headers=ator).status_code == 403
    assert _sell(client, diretor, batch["id"]).status_code == 403
    assert client.get(f"{T}/batches/{batch['id']}/tickets", headers=diretor).status_code == 200


def test_ultimo_lugar_disputado_em_paralelo(admin, production):
    """Duas vendas simultâneas do último lugar: uma passa, a outra recebe 409."""
    _, h = admin
    with TestClient(app) as c:
        batch = _batch(c, h, production["id"], seats=1)
    results = []

    def buy():
        with TestClient(app) as c:
            results.append(_sell(c, h, batch["id"]).status_code)

    threads = [threading.Thread(target=buy) for _ in range(6)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(results) == [201, 409, 409, 409, 409, 409]


def test_check_in_em_paralelo(admin, production):
    """Dois leitores na portaria com o mesmo código: só um libera a entrada."""
    _, h = admin
    with TestClient(app) as c:
        batch = _batch(c, h, production["id"])
        code = _sell(c, h, batch["id"]).json()[0]["code"]
    results = []

    def scan():
        with TestClient(app) as c:
            results.append(c.post(f"{T}/check-in", json={"code": code}, headers=h).status_code)

    threads = [threading.Thread(target=scan) for _ in range(6)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(results) == [200, 409, 409, 409, 409, 409]
