"""Cliente mínimo do Mercado Pago (Checkout Pro), via API REST.

Regras de segurança desta integração:
* A credencial vem só de variável de ambiente e nunca é registrada em log.
* Só credenciais de TESTE (prefixo "TEST-") são aceitas, a não ser que
  MERCADOPAGO_ALLOW_PRODUCTION=true seja definido de propósito.
* O Curtain não recebe dados de cartão: o comprador paga na página do
  Mercado Pago. O status de um pagamento é sempre lido da API do Mercado Pago,
  nunca do corpo do aviso (webhook), que só serve de gatilho.
"""

import hashlib
import hmac
import logging
from decimal import Decimal
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)
TIMEOUT = httpx.Timeout(15.0, connect=5.0)


class PaymentGatewayError(RuntimeError):
    """Falha ao falar com o Mercado Pago (vira 502/503 na API)."""


def is_sandbox_token(token: str) -> bool:
    return token.startswith("TEST-")


def gateway_status() -> dict:
    """Situação da venda online, sem expor nenhum segredo."""
    token = settings.MERCADOPAGO_ACCESS_TOKEN
    if not settings.PUBLIC_SALES_ENABLED:
        return {"enabled": False, "sandbox": True, "reason": "Venda online desativada."}
    if not token:
        return {"enabled": False, "sandbox": True, "reason": "Pagamento não configurado."}
    sandbox = is_sandbox_token(token)
    if not sandbox and not settings.MERCADOPAGO_ALLOW_PRODUCTION:
        return {
            "enabled": False, "sandbox": False,
            "reason": "Credencial de produção bloqueada: use uma credencial de teste (TEST-).",
        }
    return {"enabled": True, "sandbox": sandbox, "reason": None}


def _headers(idempotency_key: Optional[str] = None) -> dict:
    h = {"Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}", "Content-Type": "application/json"}
    if idempotency_key:
        h["X-Idempotency-Key"] = idempotency_key
    return h


def _url(path: str) -> str:
    return settings.MERCADOPAGO_API_URL.rstrip("/") + path


def create_preference(*, order_id: str, title: str, quantity: int, unit_price: Decimal,
                      payer_name: str, payer_email: str, return_url: str,
                      expires_at_iso: str) -> dict:
    """Cria a preferência de pagamento e devolve {id, checkout_url}."""
    status = gateway_status()
    if not status["enabled"]:
        raise PaymentGatewayError(status["reason"])

    body = {
        "items": [{
            "id": order_id,
            "title": title[:250],
            "quantity": quantity,
            "unit_price": float(unit_price),
            "currency_id": "BRL",
        }],
        "payer": {"name": payer_name, "email": payer_email},
        "external_reference": order_id,
        "back_urls": {"success": return_url, "pending": return_url, "failure": return_url},
        "expires": True,
        "expiration_date_to": expires_at_iso,
        "statement_descriptor": "CURTAIN",
        "metadata": {"order_id": order_id},
    }
    # O Mercado Pago só volta sozinho ao site em endereços https
    if return_url.startswith("https://"):
        body["auto_return"] = "approved"
    if settings.PUBLIC_API_URL:
        body["notification_url"] = (
            settings.PUBLIC_API_URL.rstrip("/") + "/api/v1/public/payments/mercadopago/webhook"
        )

    try:
        res = httpx.post(_url("/checkout/preferences"), json=body,
                         headers=_headers(idempotency_key=order_id), timeout=TIMEOUT)
    except httpx.HTTPError as exc:
        logger.warning("Mercado Pago indisponível ao criar preferência: %s", type(exc).__name__)
        raise PaymentGatewayError("Não foi possível falar com o Mercado Pago.") from exc
    if res.status_code >= 300:
        logger.warning("Mercado Pago recusou a preferência (HTTP %s).", res.status_code)
        raise PaymentGatewayError("O Mercado Pago recusou o pedido de pagamento.")
    data = res.json()
    url = data.get("sandbox_init_point") if status["sandbox"] else data.get("init_point")
    url = url or data.get("init_point")
    if not data.get("id") or not url:
        raise PaymentGatewayError("Resposta inesperada do Mercado Pago.")
    return {"id": str(data["id"]), "checkout_url": url}


def get_payment(payment_id: str) -> dict:
    """Lê um pagamento direto da API (fonte confiável do status)."""
    if not gateway_status()["enabled"]:
        raise PaymentGatewayError("Pagamento não configurado.")
    if not str(payment_id).isdigit():
        raise PaymentGatewayError("Pagamento inválido.")
    try:
        res = httpx.get(_url(f"/v1/payments/{payment_id}"), headers=_headers(), timeout=TIMEOUT)
    except httpx.HTTPError as exc:
        logger.warning("Mercado Pago indisponível ao consultar pagamento: %s", type(exc).__name__)
        raise PaymentGatewayError("Não foi possível falar com o Mercado Pago.") from exc
    if res.status_code == 404:
        raise PaymentGatewayError("Pagamento não encontrado no Mercado Pago.")
    if res.status_code >= 300:
        logger.warning("Mercado Pago recusou a consulta do pagamento (HTTP %s).", res.status_code)
        raise PaymentGatewayError("Falha ao consultar o pagamento.")
    return res.json()


def verify_webhook_signature(*, x_signature: Optional[str], x_request_id: Optional[str],
                             data_id: Optional[str]) -> bool:
    """Confere a assinatura x-signature do aviso do Mercado Pago (HMAC-SHA256).

    Modelo assinado: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
    Sem MERCADOPAGO_WEBHOOK_SECRET configurado devolve True: o aviso é tratado
    só como gatilho e o pagamento é conferido na API de qualquer jeito.
    """
    secret = settings.MERCADOPAGO_WEBHOOK_SECRET
    if not secret:
        return True
    if not x_signature:
        return False
    parts = dict(p.strip().split("=", 1) for p in x_signature.split(",") if "=" in p)
    ts, v1 = parts.get("ts"), parts.get("v1")
    if not ts or not v1:
        return False
    manifest = ""
    if data_id:
        manifest += f"id:{str(data_id).lower()};"
    if x_request_id:
        manifest += f"request-id:{x_request_id};"
    manifest += f"ts:{ts};"
    expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)


def search_payments(external_reference: str) -> list:
    """Pagamentos ligados a um pedido (usado quando o aviso não chega, ex.: localhost)."""
    if not gateway_status()["enabled"]:
        raise PaymentGatewayError("Pagamento não configurado.")
    try:
        res = httpx.get(
            _url("/v1/payments/search"),
            params={"external_reference": external_reference, "sort": "date_created", "criteria": "desc"},
            headers=_headers(), timeout=TIMEOUT,
        )
    except httpx.HTTPError as exc:
        logger.warning("Mercado Pago indisponível ao buscar pagamentos: %s", type(exc).__name__)
        raise PaymentGatewayError("Não foi possível falar com o Mercado Pago.") from exc
    if res.status_code >= 300:
        logger.warning("Mercado Pago recusou a busca de pagamentos (HTTP %s).", res.status_code)
        raise PaymentGatewayError("Falha ao consultar o pagamento.")
    return res.json().get("results", [])
