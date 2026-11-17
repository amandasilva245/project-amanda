"""Limite de tentativas de login (proteção contra força bruta).

Usa o Redis configurado em REDIS_URL quando disponível (compartilhado entre
workers e réplicas). Se o Redis não responder, cai para um contador em
memória por processo, que ainda limita, só que por worker.
"""

import logging
import threading
import time

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_FAILURES = 5          # falhas permitidas na janela
WINDOW_SECONDS = 15 * 60  # janela de 15 minutos

_redis = None
_redis_checked = False
_lock = threading.Lock()
_memory: dict[str, list[float]] = {}


def _get_redis():
    global _redis, _redis_checked
    if _redis_checked:
        return _redis
    _redis_checked = True
    if not settings.REDIS_URL or settings.ENVIRONMENT == "test":
        return None
    try:
        import redis  # dependência já existente no requirements.txt

        client = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=0.5, socket_connect_timeout=0.5)
        client.ping()
        _redis = client
    except Exception:  # Redis indisponível: segue com memória
        logger.warning("Redis indisponível; limite de login usará memória local.")
        _redis = None
    return _redis


def _key(identifier: str) -> str:
    return f"curtain:login-fail:{identifier}"


def failures(identifier: str) -> int:
    r = _get_redis()
    if r is not None:
        try:
            value = r.get(_key(identifier))
            return int(value) if value else 0
        except Exception:
            pass
    now = time.monotonic()
    with _lock:
        hits = [t for t in _memory.get(identifier, []) if now - t < WINDOW_SECONDS]
        _memory[identifier] = hits
        return len(hits)


def is_blocked(identifier: str) -> bool:
    return failures(identifier) >= MAX_FAILURES


def register_failure(identifier: str) -> None:
    r = _get_redis()
    if r is not None:
        try:
            pipe = r.pipeline()
            pipe.incr(_key(identifier))
            pipe.expire(_key(identifier), WINDOW_SECONDS)
            pipe.execute()
            return
        except Exception:
            pass
    with _lock:
        _memory.setdefault(identifier, []).append(time.monotonic())


def reset(identifier: str) -> None:
    r = _get_redis()
    if r is not None:
        try:
            r.delete(_key(identifier))
        except Exception:
            pass
    with _lock:
        _memory.pop(identifier, None)


def reset_all() -> None:
    """Usado pelos testes."""
    with _lock:
        _memory.clear()
