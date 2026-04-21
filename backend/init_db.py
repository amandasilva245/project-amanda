#!/usr/bin/env python3
"""Initialize database with test user."""

import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole


def init_db():
    """Create database tables and add default admin user."""
    engine = create_engine(str(settings.DATABASE_URL))
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        # Check if admin user already exists
        admin = session.query(User).filter(User.email == "admin@curtain.app").first()
        if admin:
            print("✓ Admin user already exists")
            return

        # Create admin user
        admin_user = User(
            email="admin@curtain.app",
            hashed_password=hash_password("Admin@123"),
            full_name="Administrator",
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(admin_user)
        session.commit()
        print("✓ Admin user created: admin@curtain.app / Admin@123")

    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        session.rollback()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    init_db()
