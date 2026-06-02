"""
Shared pytest fixtures.

The quiz-engine tests are integration-style: they exercise QuizEngineService
against a real database session. CI does not provision Postgres (DATABASE_URL
is a dummy value) and the models use Postgres-specific column types (UUID,
ARRAY) that SQLite cannot create, so when the configured database isn't
reachable we SKIP the DB-backed tests rather than fail the build. The
pure-logic IRT tests don't depend on `db` and run everywhere.
"""

import pytest
from sqlalchemy.orm import Session

from database import _get_engine, _get_session_factory, Base
import models  # noqa: F401 — registers all tables on Base.metadata


@pytest.fixture
def db() -> Session:
    """Yield a real-DB session, or skip the test if no database is reachable."""
    engine = _get_engine()
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:  # connection refused, auth failure, etc.
        pytest.skip(f"No database available for DB-backed tests: {e}")

    session = _get_session_factory()()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
