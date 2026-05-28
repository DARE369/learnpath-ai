# Contributing Guidelines

## Code Standards

### Python (Backend)
- **Lint:** Flake8 — `python -m flake8 . --count --select=E9,F63,F7,F82` (matches CI exactly)
- **Format:** Black — `black .` (local only, not enforced in CI)
- **Type checking:** MyPy — `mypy .` (local only)
- **Style:** PEP 8
- **No unused imports** — flake8 catches F401/F82 violations

### JavaScript/TypeScript (Frontend)
- **Lint:** ESLint — `npm run lint`
- **Format:** Prettier (integrated with ESLint)
- **Style:** Next.js / Airbnb conventions

---

## Commit Message Format

```
<type>(<scope>): <subject>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

**Scopes:** packet number, service name, or area (e.g. `1.2`, `eqs`, `ci`, `docs`)

**Examples:**
```
feat(1.2): add EQS scoring engine with 14-question rubric
fix(ci): use python -m pytest to avoid PATH issues
docs(api): document summary endpoint request/response
test(1.4): add cycle detection unit tests
```

---

## Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes **with tests**
3. Run lint + tests locally (see commands below)
4. **Update relevant docs in the same PR** (API_SPEC.md, INDEX.md, etc.)
5. Commit with clear messages
6. Push: `git push origin feature/my-feature`
7. Open PR against `main`
8. Wait for CI/CD to pass (both `test-backend` and `test-frontend` jobs)
9. Code review approval
10. Merge

---

## Testing Requirements

### Backend

```bash
# Run all tests (matches CI)
python -m pytest tests/ -v

# Unit tests only (no API keys or DB needed)
python -m pytest tests/unit/ -v

# Lint (matches CI exactly — only fatal errors checked)
python -m flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
```

- All new services must have unit tests in `tests/unit/`
- Mock all external calls (Claude API, YouTube API) in unit tests
- Integration tests go in `tests/integration/`
- Target: no new code without at least 1 test

### Frontend

```bash
npm run lint     # ESLint check (runs in CI)
npm test         # Jest tests (not yet configured — skip in Stage 0/1)
```

---

## Documentation Rule

**Docs must be updated in the same commit as the code change.**

When you add or change an endpoint, service, or configuration:

| Changed | Update |
|---|---|
| New API endpoint | `docs/API_SPEC.md` |
| Packet complete | `docs/INDEX.md` + `docs/README.md` build stages |
| New env variable | `docs/ENVIRONMENT_SETUP.md` |
| Architecture change | `docs/ARCHITECTURE.md` |
| New DB table | `docs/DATABASE_SCHEMA.md` |
| Setup process changed | `docs/GETTING_STARTED.md` |

Use the [Documentation Checklist](DOCUMENTATION_CHECKLIST.md) before submitting any PR.

---

## Adding a New Service

Follow this pattern (consistent with existing services):

```python
# backend/services/my_service.py
import logging
from config import settings

logger = logging.getLogger(__name__)

class MyService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY  # or whichever key
    
    async def do_thing(self, ...) -> dict:
        if not self.api_key:
            raise ValueError("API_KEY not configured")
        # implementation
```

```python
# backend/routers/my_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.my_service import MyService

router = APIRouter()
_service = MyService()

class MyRequest(BaseModel):
    field: str

@router.post("/action")
async def my_action(request: MyRequest):
    try:
        return await _service.do_thing(request.field)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

Then register in `main.py`:
```python
from routers import my_router
app.include_router(my_router.router, prefix="/api/my", tags=["my"])
```
