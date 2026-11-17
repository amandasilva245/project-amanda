#!/bin/sh
set -e

# Migrações (com lock, seguro para várias réplicas) + administrador inicial.
# Se falhar, o contêiner não sobe: melhor do que rodar com schema errado.
echo "Aplicando migrações e verificando o administrador inicial..."
python init_db.py

echo "Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "${UVICORN_WORKERS:-4}"
