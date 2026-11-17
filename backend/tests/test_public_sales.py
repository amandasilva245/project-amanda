"""Fase 8: venda online com Mercado Pago (sandbox). O Mercado Pago é simulado."""

import hashlib
import hmac
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.models.order import TicketOrder
from app.services import mercadopago as mp

P = "/api/v1/public"
T = "/api/v1/tickets"


class FakeMP:
    """Substitui as chamadas HTTP ao Mercado Pago."""

    def __init__(self):
        self.preferences = []
        self.payments = {}
        self.fail_preference = False

    def create_preference(self, **kw):
        if self.fail_preference:
            raise mp.PaymentGatewayError("O Mercado Pago recusou o pedido de pagamento.")
        self.preferences.append(kw)
        return {"id": f"pref-{len(self.preferences)}", "checkout_url": "https://sandbox.mercadopago.com.br/checkout/x"}

    def pay(self, order_id, amount, status="approved", pid=None):
        pid = pid or str(1000 + len(self.payments))
        self.payments[pid] = {"id": int(pid), "status": status, "external_reference": order_id,
                              "transaction_amount": float(amount), "currency_id": "BRL"}
        return pid

    def get_payment(self, pid):
        if pid not in self.payments:
            raise mp.PaymentGatewayError("Pagamento não encontrado no Mercado Pago.")
        return self.payments[pid]

    def search_payments(self, ref):
        return [p for p in reversed(list(self.payments.values())) if p["external_reference"] == ref]


@pytest.fixture
def fake_mp(monkeypatch):
    fake = FakeMP()
    monkeypatch.setattr(settings, "PUBLIC_SALES_ENABLED", True)
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "TEST-0000-falso")
    monkeypatch.setattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", "")
    monkeypatch.setattr(settings, "MERCADOPAGO_ALLOW_PRODUCTION", False)
    monkeypatch.setattr(mp, "create_preference", fake.create_preference)
    monkeypatch.setattr(mp, "get_payment", fake.get_payment)
    monkeypatch.setattr(mp, "search_payments", fake.search_payments)
    return fake


@pytest.fixture
def batch(client, admin, production):
    _, h = admin
    assert client.patch(f"/api/v1/productions/{production['id']}", json={"is_public": True}, headers=h).status_code == 200
    res = client.post(f"{T}/batches", json={
        "production_id": production["id"], "performance_date": "2027-03-10T20:00:00-03:00",
        "total_seats": 4, "price": "60.00", "price_premium": "120.00",
    }, headers=h)
    assert res.status_code == 201, res.text
    return res.json()


def _order(client, batch_id, **extra):
    body = {"batch_id": batch_id, "buyer_name": "Joana Lima", "buyer_email": "Joana@Exemplo.com",
            "quantity": 2, "accept_terms": True}
    body.update(extra)
    return client.post(f"{P}/orders", json=body)


def _batch_state(client, h):
    return client.get(f"{T}/batches", headers=h).json()[0]


# ── Proteções ─────────────────────────────────────────────────────────────────
def test_venda_desligada_por_padrao(client, batch, monkeypatch):
    monkeypatch.setattr(settings, "PUBLIC_SALES_ENABLED", False)
    assert client.get(f"{P}/status").json()["enabled"] is False
    assert _order(client, batch["id"]).status_code == 503


def test_credencial_de_producao_e_bloqueada(client, batch, fake_mp, monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "APP_USR-credencial-real")
    st = client.get(f"{P}/status").json()
    assert st["enabled"] is False and "produção" in st["reason"]
    assert _order(client, batch["id"]).status_code == 503
    assert fake_mp.preferences == []
    # Nunca expõe a credencial
    assert "APP_USR" not in str(st)


def test_status_nao_expoe_segredos(client, fake_mp):
    body = client.get(f"{P}/status").json()
    assert body == {"enabled": True, "sandbox": True, "reason": None, "hold_minutes": settings.ORDER_HOLD_MINUTES}


def test_vitrine_so_mostra_producoes_publicas(client, admin, batch, production, fake_mp):
    _, h = admin
    events = client.get(f"{P}/events").json()
    assert len(events) == 1 and events[0]["title"] == "Hamlet" and events[0]["available_seats"] == 4
    client.patch(f"/api/v1/productions/{production['id']}", json={"is_public": False}, headers=h)
    assert client.get(f"{P}/events").json() == []
    assert _order(client, batch["id"]).status_code == 404


def test_exige_consentimento(client, batch, fake_mp):
    assert _order(client, batch["id"], accept_terms=False).status_code == 422


# ── Fluxo de compra ───────────────────────────────────────────────────────────
def test_compra_aprovada_confirma_ingressos(client, admin, batch, fake_mp):
    _, h = admin
    res = _order(client, batch["id"])
    assert res.status_code == 201, res.text
    created = res.json()
    assert created["checkout_url"].startswith("https://sandbox.")
    assert float(created["total_amount"]) == 120.0
    pref = fake_mp.preferences[0]
    assert pref["quantity"] == 2 and float(pref["unit_price"]) == 60.0
    assert created["token"] in pref["return_url"]

    # Lugares guardados enquanto paga; códigos ainda escondidos
    assert _batch_state(client, h)["tickets_sold"] == 2
    view = client.get(f"{P}/orders/{created['order_id']}", params={"t": created["token"]}).json()
    assert view["status"] == "pending" and view["tickets"] == [] and view["buyer_email"] == "j***@exemplo.com"

    pid = fake_mp.pay(created["order_id"], 120.0)
    assert client.post(f"{P}/payments/mercadopago/webhook", params={"type": "payment", "data.id": pid}).status_code == 200
    view = client.get(f"{P}/orders/{created['order_id']}", params={"t": created["token"]}).json()
    assert view["status"] == "paid" and len(view["tickets"]) == 2
    assert all(t["status"] == "confirmed" for t in view["tickets"])

    # Aviso repetido não muda nada (idempotente)
    client.post(f"{P}/payments/mercadopago/webhook", params={"type": "payment", "data.id": pid})
    assert _batch_state(client, h)["tickets_sold"] == 2

    # O ingresso comprado online entra na portaria
    code = view["tickets"][0]["code"]
    assert client.post(f"{T}/check-in", json={"code": code}, headers=h).status_code == 200

    # A equipe vê o pedido
    orders = client.get(f"{T}/orders", headers=h).json()
    assert orders[0]["status"] == "paid" and orders[0]["provider_payment_id"] == pid


def test_token_errado_nao_mostra_pedido(client, batch, fake_mp):
    created = _order(client, batch["id"]).json()
    assert client.get(f"{P}/orders/{created['order_id']}", params={"t": "x" * 32}).status_code == 404


def test_valor_divergente_nao_confirma(client, batch, fake_mp):
    created = _order(client, batch["id"]).json()
    pid = fake_mp.pay(created["order_id"], 1.00)
    client.post(f"{P}/payments/mercadopago/webhook", params={"type": "payment", "data.id": pid})
    view = client.get(f"{P}/orders/{created['order_id']}", params={"t": created["token"]}).json()
    assert view["status"] == "pending" and view["tickets"] == []


def test_conferir_pagamento_sem_webhook(client, batch, fake_mp):
    created = _order(client, batch["id"], quantity=1).json()
    fake_mp.pay(created["order_id"], 60.0, status="rejected")
    fake_mp.pay(created["order_id"], 60.0, status="approved")
    view = client.post(f"{P}/orders/{created['order_id']}/refresh", json={"token": created["token"]}).json()
    assert view["status"] == "paid" and len(view["tickets"]) == 1


def test_lotacao_respeitada_e_falha_do_gateway_devolve_lugares(client, admin, batch, fake_mp):
    _, h = admin
    assert _order(client, batch["id"], quantity=3).status_code == 201
    res = _order(client, batch["id"], quantity=2)
    assert res.status_code == 409 and "Restam apenas 1" in res.json()["detail"]

    fake_mp.fail_preference = True
    assert _order(client, batch["id"], quantity=1).status_code == 502
    assert _batch_state(client, h)["tickets_sold"] == 3


def test_pedido_vencido_libera_lugares_e_pagamento_tardio(client, admin, batch, fake_mp, db):
    _, h = admin
    created = _order(client, batch["id"], quantity=4).json()
    assert _batch_state(client, h)["status"] == "sold_out"

    db.query(TicketOrder).filter(TicketOrder.id == created["order_id"]).update(
        {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)})
    db.commit()
    view = client.get(f"{P}/orders/{created['order_id']}", params={"t": created["token"]}).json()
    assert view["status"] == "expired" and view["checkout_url"] is None
    b = _batch_state(client, h)
    assert b["tickets_sold"] == 0 and b["status"] == "on_sale"

    # Pagou depois do prazo e ainda há lugar: o pedido volta a valer
    pid = fake_mp.pay(created["order_id"], 240.0)
    client.post(f"{P}/payments/mercadopago/webhook", params={"type": "payment", "data.id": pid})
    view = client.get(f"{P}/orders/{created['order_id']}", params={"t": created["token"]}).json()
    assert view["status"] == "paid" and len(view["tickets"]) == 4
    assert _batch_state(client, h)["tickets_sold"] == 4


def test_pagamento_tardio_sem_lugar_marca_estorno(client, admin, batch, fake_mp, db):
    _, h = admin
    first = _order(client, batch["id"], quantity=4).json()
    db.query(TicketOrder).filter(TicketOrder.id == first["order_id"]).update(
        {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)})
    db.commit()
    second = _order(client, batch["id"], quantity=4).json()  # vence o primeiro e ocupa tudo
    pid = fake_mp.pay(first["order_id"], 240.0)
    client.post(f"{P}/payments/mercadopago/webhook", params={"type": "payment", "data.id": pid})
    view = client.get(f"{P}/orders/{first['order_id']}", params={"t": first["token"]}).json()
    assert view["status"] == "needs_refund" and view["tickets"] == []
    assert _batch_state(client, h)["tickets_sold"] == 4
    assert client.get(f"{P}/orders/{second['order_id']}", params={"t": second["token"]}).json()["status"] == "pending"


def test_estorno_cancela_ingressos(client, admin, batch, fake_mp):
    _, h = admin
    created = _order(client, batch["id"], quantity=2).json()
    pid = fake_mp.pay(created["order_id"], 120.0)
    client.post(f"{P}/payments/mercadopago/webhook", params={"type": "payment", "data.id": pid})
    fake_mp.payments[pid]["status"] = "refunded"
    client.post(f"{P}/payments/mercadopago/webhook", params={"type": "payment", "data.id": pid})
    view = client.get(f"{P}/orders/{created['order_id']}", params={"t": created["token"]}).json()
    assert view["status"] == "refunded"
    assert _batch_state(client, h)["tickets_sold"] == 0


def test_producao_com_pedidos_nao_e_excluida(client, admin, batch, production, fake_mp):
    _, h = admin
    _order(client, batch["id"], quantity=1)
    assert client.delete(f"/api/v1/productions/{production['id']}", headers=h).status_code == 409


def test_limite_de_pedidos_por_ip(client, batch, fake_mp):
    codes = [_order(client, batch["id"], quantity=1, buyer_email=f"a{i}@x.com").status_code for i in range(12)]
    assert 429 in codes


def test_pedidos_so_para_quem_gerencia(client, make_user):
    from app.models.user import UserRole
    _, h = make_user(UserRole.ACTOR)
    assert client.get(f"{T}/orders", headers=h).status_code == 403


# ── Assinatura do webhook ─────────────────────────────────────────────────────
def _sign(secret, data_id, request_id, ts="1700000000"):
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    return f"ts={ts},v1=" + hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()


def test_webhook_com_assinatura(client, batch, fake_mp, monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", "segredo-de-teste")
    created = _order(client, batch["id"], quantity=1).json()
    pid = fake_mp.pay(created["order_id"], 60.0)
    url = f"{P}/payments/mercadopago/webhook"
    params = {"type": "payment", "data.id": pid}

    assert client.post(url, params=params).status_code == 401
    bad = _sign("outro-segredo", pid, "req-1")
    assert client.post(url, params=params, headers={"x-signature": bad, "x-request-id": "req-1"}).status_code == 401

    good = _sign("segredo-de-teste", pid, "req-1")
    assert client.post(url, params=params, headers={"x-signature": good, "x-request-id": "req-1"}).status_code == 200
    view = client.get(f"{P}/orders/{created['order_id']}", params={"t": created["token"]}).json()
    assert view["status"] == "paid"


# ── Cliente HTTP do Mercado Pago ──────────────────────────────────────────────
def test_cliente_cria_preferencia_sandbox_sem_vazar_token(monkeypatch, caplog):
    import httpx
    from decimal import Decimal

    monkeypatch.setattr(settings, "PUBLIC_SALES_ENABLED", True)
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "TEST-segredo-123")
    monkeypatch.setattr(settings, "PUBLIC_API_URL", "https://api.exemplo.com")
    sent = {}

    def fake_post(url, json, headers, timeout):
        sent.update(url=url, json=json, headers=headers)
        return httpx.Response(201, json={"id": "p1", "init_point": "https://www.mercadopago.com.br/real",
                                         "sandbox_init_point": "https://sandbox.mercadopago.com.br/teste"})

    monkeypatch.setattr(httpx, "post", fake_post)
    out = mp.create_preference(order_id="o1", title="Hamlet", quantity=2, unit_price=Decimal("60.00"),
                               payer_name="Ana", payer_email="ana@x.com",
                               return_url="http://localhost:5173/ingressos/pedido/o1?t=abc",
                               expires_at_iso="2027-01-01T00:00:00.000+00:00")
    assert out == {"id": "p1", "checkout_url": "https://sandbox.mercadopago.com.br/teste"}
    assert sent["url"].endswith("/checkout/preferences")
    assert sent["json"]["external_reference"] == "o1" and sent["json"]["items"][0]["currency_id"] == "BRL"
    assert "auto_return" not in sent["json"]  # localhost não é https
    assert sent["json"]["notification_url"].startswith("https://api.exemplo.com/")
    assert sent["headers"]["X-Idempotency-Key"] == "o1"

    def failing_post(*a, **k):
        return httpx.Response(400, json={"message": "bad"})

    monkeypatch.setattr(httpx, "post", failing_post)
    with pytest.raises(mp.PaymentGatewayError):
        mp.create_preference(order_id="o2", title="x", quantity=1, unit_price=Decimal("1"),
                             payer_name="a", payer_email="a@x.com", return_url="https://s/x",
                             expires_at_iso="2027-01-01T00:00:00.000+00:00")
    assert "TEST-segredo-123" not in caplog.text


def test_cliente_recusa_id_de_pagamento_invalido(monkeypatch):
    monkeypatch.setattr(settings, "PUBLIC_SALES_ENABLED", True)
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "TEST-x")
    with pytest.raises(mp.PaymentGatewayError):
        mp.get_payment("../v1/users/me")


def test_titulo_do_pagamento_usa_horario_de_brasilia(client, batch, fake_mp):
    _order(client, batch["id"], quantity=1)
    assert "10/03/2027 20:00" in fake_mp.preferences[0]["title"]
