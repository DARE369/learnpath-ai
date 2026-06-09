"""Alembic environment (Stage 5).

Targets the live SQLAlchemy metadata so `alembic revision --autogenerate` can
diff models against the DB. The URL comes from config.settings (single source of
truth); online mode reuses the app's configured engine.
"""
from logging.config import fileConfig

from alembic import context

# The app modules live at backend/ root (prepend_sys_path = . in alembic.ini).
from config import settings  # noqa: E402
from database import Base, _get_engine  # noqa: E402
import models  # noqa: F401,E402  — import for side effect: registers all tables on Base.metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = _get_engine()
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
