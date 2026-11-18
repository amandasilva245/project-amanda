from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # Application
    APP_NAME: str = "Curtain"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    # Ambiente de demonstração (banca): mostra o aviso "dados fictícios" e
    # libera o script demo.py. Só funciona com um banco cujo nome termina em "_demo".
    DEMO_MODE: bool = False
    # Fuso usado em textos gerados pelo servidor (ex.: "já utilizado às 20:15")
    APP_TIMEZONE: str = "America/Sao_Paulo"

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    # Storage
    STORAGE_BACKEND: str = "local"
    MEDIA_ROOT: str = "media"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "us-east-1"

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@curtain.app"

    # Venda online (fase 8). Desligada por padrão.
    PUBLIC_SALES_ENABLED: bool = False
    # Endereço do site (frontend), usado nos links de volta do checkout
    PUBLIC_SITE_URL: str = "http://localhost:5173"
    # Endereço público da API, para o Mercado Pago avisar os pagamentos (webhook).
    # Vazio = sem webhook; o status é conferido quando o comprador volta ao site.
    PUBLIC_API_URL: str = ""
    # Minutos que os lugares ficam guardados enquanto o pagamento não sai
    ORDER_HOLD_MINUTES: int = 30

    # Mercado Pago. Só credenciais de teste (TEST-...) são aceitas, a menos que
    # MERCADOPAGO_ALLOW_PRODUCTION=true seja definido de propósito.
    MERCADOPAGO_ACCESS_TOKEN: str = ""
    MERCADOPAGO_WEBHOOK_SECRET: str = ""
    MERCADOPAGO_API_URL: str = "https://api.mercadopago.com"
    MERCADOPAGO_ALLOW_PRODUCTION: bool = False


settings = Settings()


def local_time(dt):
    """Converte um datetime com fuso para o fuso do teatro (APP_TIMEZONE)."""
    from datetime import timedelta, timezone
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    try:
        tz = ZoneInfo(settings.APP_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):  # imagem sem tzdata: horário de Brasília
        tz = timezone(timedelta(hours=-3))
    return dt.astimezone(tz)
