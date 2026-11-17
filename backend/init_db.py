#!/usr/bin/env python3
"""Aplica as migrações e cria o administrador inicial, se ainda não existir.

Credenciais do administrador inicial:
  * ADMIN_EMAIL    (padrão: admin@curtain.app)
  * ADMIN_PASSWORD (se ausente, uma senha forte é gerada e gravada em
    ADMIN_PASSWORD_FILE, padrão `.admin-initial-password`, com permissão 600;
    a senha nunca é impressa no terminal nem nos logs).
"""

import os
import secrets
import string
import sys

from sqlalchemy.orm import sessionmaker

from app.core.database import engine
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.user import _validate_password_strength
import app.models  # noqa: F401 — registra todos os modelos no metadata

from migrate import migrate


def _generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if any(c.isupper() for c in pwd) and any(c.isdigit() for c in pwd) and any(c.islower() for c in pwd):
            return pwd


def init_db():
    migrate()

    email = os.environ.get("ADMIN_EMAIL", "admin@curtain.app").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "")

    session = sessionmaker(bind=engine)()
    try:
        if session.query(User).filter(User.role == UserRole.ADMIN).first():
            print("✓ Já existe um administrador; nada a fazer.")
            return

        generated = False
        if password:
            try:
                _validate_password_strength(password)
            except ValueError as exc:
                print(f"✗ ADMIN_PASSWORD inválida: {exc}", file=sys.stderr)
                sys.exit(1)
        else:
            password = _generate_password()
            generated = True

        session.add(User(
            email=email,
            hashed_password=hash_password(password),
            full_name="Administrador",
            role=UserRole.ADMIN,
            is_active=True,
        ))
        session.commit()

        if generated:
            path = os.environ.get("ADMIN_PASSWORD_FILE", ".admin-initial-password")
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w") as fh:
                fh.write(password + "\n")
            print(f"✓ Administrador criado: {email}. Senha gerada salva em {os.path.abspath(path)} "
                  "(leia, troque em Configurações e apague o arquivo).")
        else:
            print(f"✓ Administrador criado: {email} (senha definida por ADMIN_PASSWORD).")
    except Exception as exc:  # pragma: no cover — script de linha de comando
        session.rollback()
        print(f"✗ Erro: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    init_db()
