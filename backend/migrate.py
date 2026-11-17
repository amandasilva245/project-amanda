#!/usr/bin/env python3
"""Aplica as migrações Alembic de forma segura (sem recriar nada).

* Banco vazio: `alembic upgrade head` cria tudo.
* Banco criado antes das migrações (via create_all), com ou sem uma tabela
  alembic_version vazia: é marcado como 0001
  (`stamp`), que corresponde exatamente ao schema antigo, e só então as
  migrações seguintes são aplicadas. Nenhuma tabela é apagada.
* Um advisory lock do PostgreSQL impede que duas réplicas migrem ao mesmo
  tempo (RNF07).
"""

import os

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.core.database import engine

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCK_ID = 7_281_042  # identificador arbitrário e fixo do lock de migração


def _config() -> Config:
    cfg = Config(os.path.join(BASE_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BASE_DIR, "alembic"))
    return cfg


def migrate() -> None:
    cfg = _config()
    with engine.connect() as conn:
        conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": LOCK_ID})
        try:
            tables = set(inspect(conn).get_table_names())
            versioned = False
            if "alembic_version" in tables:
                # A versão antiga do projeto já tinha o Alembic configurado sem
                # nenhuma migração: a tabela pode existir, porém vazia.
                versioned = conn.execute(text("SELECT count(*) FROM alembic_version")).scalar() > 0
            if "users" in tables and not versioned:
                print("• Banco anterior às migrações detectado: marcando como 0001 (sem alterações).")
                command.stamp(cfg, "0001")
            command.upgrade(cfg, "head")
            print("✓ Migrações aplicadas.")
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})
            conn.commit()


if __name__ == "__main__":
    migrate()
