"""
Database engine and session setup.

Uses SQLite as specified in the Data Layer (Chapter 3, 3.5.4).
create_all() is used instead of Alembic migrations since the schema is
fixed for the scope of this thesis prototype.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base

DATABASE_URL = "sqlite:///./academic_repository.db"

# check_same_thread=False is needed because frameworks like FastAPI/Flask
# may handle a single SQLite connection across different threads.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all tables if they don't already exist."""
    Base.metadata.create_all(bind=engine)


def get_session():
    """
    Dependency-style generator for use with FastAPI's Depends(),
    or call next(get_session()) manually in scripts.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
