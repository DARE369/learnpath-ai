# Getting Started — Local Development

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ | 3.11 recommended (matches CI) |
| Node.js | 20.19.0+ | Must be ≥ 20 (CI uses 20.19.0) |
| Git | Any | |
| VS Code | Recommended | With Python + ESLint extensions |

---

## Backend Setup (FastAPI)

### 1. Create Python Virtual Environment

```bash
cd backend
python3.11 -m venv venv

# Activate
# macOS/Linux:
source venv/bin/activate
# Windows (PowerShell):
venv\Scripts\Activate.ps1
# Windows (CMD):
venv\Scripts\activate.bat
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

> **CI uses** `requirements-ci.txt` (lightweight, no psycopg2/PyJWT).
> For local development always use `requirements.txt`.

### 3. Create `.env` File

```bash
cp .env.example .env   # if .env.example exists, otherwise create manually
```

Minimum required variables for local development:

```env
DATABASE_URL=postgresql://user:pass@localhost/learnpath
JWT_SECRET=your-32-character-secret-key-here-!!
ENVIRONMENT=development
DEBUG=true

# Stage 1 APIs (needed for pipeline endpoints)
YOUTUBE_API_KEY=AIzaSy...
CLAUDE_API_KEY=sk-ant-...
```

See [Environment Setup](ENVIRONMENT_SETUP.md) for the full variable reference.

### 4. Run Backend Server

```bash
uvicorn main:app --reload
```

| URL | Purpose |
|---|---|
| http://localhost:8000 | API root |
| http://localhost:8000/docs | Swagger UI (interactive) |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/health | Health check |

### 5. Run Tests

```bash
# All tests
python -m pytest tests/ -v

# Unit tests only (no DB or API keys needed)
python -m pytest tests/unit/ -v

# Lint check (matches CI exactly)
python -m flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
```

---

## Frontend Setup (Next.js)

### 1. Install Dependencies

```bash
cd frontend
npm ci
```

### 2. Create Environment File

```bash
cp .env.example .env.local   # or create manually
```

Minimum required:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3. Run Development Server

```bash
npm run dev
```

Frontend runs on: http://localhost:3000

### 4. Lint

```bash
npm run lint
```

---

## Database Setup (Supabase)

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign in with GitHub
3. Create new project: `learnpath-ai`
4. Choose region closest to your users

### 2. Get Connection String
- Project Settings → Database → Connection string (URI)
- Copy to `backend/.env` as `DATABASE_URL`

### 3. Apply Schema
- Project Settings → API → Copy Project URL and anon key to `frontend/.env.local`
- Apply the schema via the Supabase dashboard SQL editor
  (schema defined in `docs/DATABASE_SCHEMA.md`)

---

## Running Both Servers

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate      # Windows: venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Stage 1 API Keys

The Stage 1 pipeline requires two external API keys to function. Without them, the endpoints return `400 Bad Request` but the server still starts and tests still pass.

| Key | Where to get | Used by |
|---|---|---|
| `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → YouTube Data API v3 | `/api/youtube/*` |
| `CLAUDE_API_KEY` | [Anthropic Console](https://console.anthropic.com) → API Keys | `/api/eqs/*`, `/api/summary/*`, `/api/concepts/*` |

---

## Development Workflow

1. Create a branch: `git checkout -b feature/my-feature`
2. Make changes with tests
3. Run lint + tests locally
4. Commit: `git commit -m "feat(scope): description"`
5. Push: `git push origin feature/my-feature`
6. Open a Pull Request → CI runs automatically
7. Merge when CI passes and reviewed

---

## Troubleshooting

**`ModuleNotFoundError` in Python**
→ Virtual environment not activated. Run `source venv/bin/activate`.

**`DATABASE_URL` missing error on startup**
→ Check `backend/.env` exists and has a valid `DATABASE_URL`.

**`YOUTUBE_API_KEY not configured` (400 error)**
→ Normal if key not set. Add to `backend/.env` to use YouTube endpoints.

**Port 3000 already in use**
- Windows: `netstat -ano | findstr :3000` → `taskkill /PID <pid> /F`
- macOS/Linux: `lsof -ti:3000 | xargs kill -9`

**`next lint` error about project directory**
→ Run `npm ci` first to ensure `node_modules` is complete.
