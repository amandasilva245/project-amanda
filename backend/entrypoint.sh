#!/bin/sh
set -e

# Migrações (com lock, seguro para várias réplicas) + administrador inicial.
# Se falhar, o contêiner não sobe: melhor do que rodar com schema errado.
echo "Aplicando migrações e verificando o administrador inicial..."
python init_db.py

# Em desenvolvimento, recarrega sozinho ao salvar um arquivo (o código está
# montado em /app pelo docker-compose). Em produção, vários workers (RNF11).
if [ "${ENVIRONMENT:-production}" = "development" ]; then
  echo "Starting Uvicorn (desenvolvimento, com hot-reload)..."
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/app
fi

echo "Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "${UVICORN_WORKERS:-4}"
