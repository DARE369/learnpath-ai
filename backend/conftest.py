import os

# Set required env vars before any app modules are imported.
# Pydantic-settings reads from the environment, so these must be in place
# before the first `from config import settings` call anywhere in the test tree.
os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost/db")
os.environ.setdefault("JWT_SECRET", "ci_dummy_secret_that_is_32_chars_long_x")
os.environ.setdefault("ENVIRONMENT", "staging")
