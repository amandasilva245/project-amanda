"""Utilidades de privacidade (LGPD)."""


def mask_email(email: str) -> str:
    """'maria.silva@exemplo.com' -> 'm***@exemplo.com' (para logs)."""
    if not email or "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    return f"{local[:1]}***@{domain}"
