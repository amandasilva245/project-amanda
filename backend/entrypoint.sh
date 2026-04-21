#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head || echo "Alembic migration skipped (tables may already exist or DB not ready)"

echo "Initializing database with default user..."
python init_db.py || echo "Database initialization skipped (may have users already)"

echo "Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
