# Database migrations (Alembic)

Alembic is set up under `backend/alembic/`. The app **still** also runs
`Base.metadata.create_all` + idempotent column patches at boot (`main.py`), so
nothing breaks during the transition — Alembic is the path for *versioned* schema
changes going forward, and `create_all` can be retired once the team is on it.

## One-time setup on the existing (production) database
The baseline migration (`0001_baseline`) recreates the full schema via
`create_all` (idempotent). On a DB that already has the tables, mark it applied
**without** re-running:

```bash
cd backend
alembic stamp head
```

## Everyday workflow
After changing `models.py`:

```bash
cd backend
alembic revision --autogenerate -m "add X to Y"   # diffs models vs DB
# review the generated file in alembic/versions/ — autogenerate is not perfect
alembic upgrade head                                # apply locally
```

Commit the generated migration. In deploy, run `alembic upgrade head` before/at
release (e.g. a Railway release command) instead of relying on `create_all`.

## Notes
- The DB URL comes from `config.settings.DATABASE_URL` (set in `alembic/env.py`);
  never hardcode it in `alembic.ini`.
- `compare_type=True` is on, so column type changes are detected.
- Autogenerate won't catch everything (server defaults, some constraint changes,
  data backfills) — hand-edit the migration when needed.
- Fresh dev DB: `alembic upgrade head` creates the whole schema from scratch.
