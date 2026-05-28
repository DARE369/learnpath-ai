# LearnPath AI — System Architecture

## High-Level Overview

LearnPath AI is a 3-tier application:

1. **Frontend (Next.js)** — User interface, browser-based
2. **Backend (FastAPI)** — API, business logic, AI pipeline
3. **Database (Supabase/PostgreSQL)** — Data persistence

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      USER BROWSER                            │
│                (Next.js 14 Frontend App)                     │
│  - Auth pages (Stage 2)                                      │
│  - Learning session UI (Stage 2)                             │
│  - Dashboard (Stage 2)                                       │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP/HTTPS REST API
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                 BACKEND API (FastAPI / Python 3.11)          │
│                                                              │
│  Stage 1 — Core Pipeline (LIVE):                            │
│  - GET  /api/youtube/search|details|transcript               │
│  - POST /api/eqs/score                                       │
│  - POST /api/summary/generate                                │
│  - POST /api/concepts/extract|build|sort                     │
│  - POST /api/path/assemble|validate                          │
│                                                              │
│  Stage 2 — User Layer (planned):                            │
│  - POST /api/auth/signup|login|refresh                       │
│  - GET  /api/session/*                                       │
│  - GET  /api/progress/*                                      │
│                                                              │
│  Services (Stage 1):                                         │
│  ├── YouTubeService      — search, video details, transcripts│
│  ├── EQSService          — 14-question rubric via Claude Opus│
│  ├── SummaryService      — structured summaries via Claude   │
│  ├── ConceptGraphService — prerequisite maps, topo sort      │
│  └── PathService         — rank, order, validate paths       │
└──────────┬─────────────────────────┬────────────────────────┘
           │ SQL (SQLAlchemy)         │ HTTPS
           ▼                         ▼
┌──────────────────────┐    ┌────────────────────────────────┐
│ DATABASE             │    │ EXTERNAL APIs                  │
│ (Supabase/PostgreSQL)│    │ ├── YouTube Data API v3        │
│ - users              │    │ ├── Anthropic API (Claude)     │
│ - topics             │    │ │     claude-opus-4-7  (EQS)   │
│ - videos             │    │ │     claude-sonnet-4-6 (sum.) │
│ - video_scores       │    │ │     claude-opus-4-7  (graph) │
│ - user_progress      │    │ └── Google Generative AI (tbd) │
│ - path_sessions      │    └────────────────────────────────┘
│ - concept_graphs*    │
│ - learning_paths*    │
└──────────────────────┘
* schema defined, SQLAlchemy model pending
```

---

## Stage 1 Pipeline Flow

When a user searches for a topic, the backend executes this pipeline:

```
User: "Teach me photosynthesis"
  │
  ▼
1. YouTube Search (/api/youtube/search)
   └── Returns: list of candidate videos
  │
  ▼
2. EQS Scoring (/api/eqs/score)  ← Claude Opus (per video)
   └── Returns: score 0–100, tier 1–4
  │
  ▼
3. Summary Generation (/api/summary/generate)  ← Claude Sonnet
   └── Returns: summary, key_concepts, sections
  │
  ▼
4. Concept Graph (/api/concepts/extract → /build)  ← Claude Opus
   └── Returns: prerequisite map, topological order
  │
  ▼
5. Path Assembly (/api/path/assemble)
   └── Returns: ordered video_sequence, avg EQS, validation
  │
  ▼
Frontend: displays ordered learning path
```

---

## Learning Session Flow (Stage 2)

```
User clicks "Start Learning"
  ↓
Backend creates session → returns first video
  ↓
Frontend: YouTube IFrame + summary + key concepts displayed
  ↓
User watches video
  ↓
Video ends → active recall question generated (Claude)
  ↓
User submits answer → Claude evaluates
  ↓
Feedback displayed → next video loaded
  ↓
Progress saved to user_progress table
```

---

## Current Implementation Status

### Stage 0 — Foundation ✅
- GitHub repo + branch protection
- Environment configuration (pydantic-settings)
- Supabase database with 6-table schema
- Vercel deployment pipeline
- FastAPI skeleton + CI/CD (GitHub Actions)
- Documentation infrastructure

### Stage 1 — Core Pipeline ✅ (All 6 packets complete)
- YouTube API integration (search, details, transcript)
- EQS engine (14-question binary rubric, 4 tiers, Claude Opus)
- Summary generation (structured JSON via Claude Sonnet)
- Concept graph (prerequisite mapping, DFS cycle detection, Kahn's sort)
- Path assembly (rank by EQS ≥ 65, order by prerequisites, validate)
- Two-layer caching (in-memory, TTL: topics 30d / queries 7d)
- SearchService orchestrator (full pipeline end-to-end)

### Stage 2–7 — Planned ⬜
- User authentication (JWT + Supabase Auth)
- Learning sessions + active recall
- Progress tracking
- Intelligence features
- Monetisation + B2B

---

## Technology Decisions

| Component | Choice | Reasoning |
|---|---|---|
| Frontend | Next.js 14 | SSR, SEO, Vercel native |
| Backend | FastAPI (Python 3.11) | Async, fast, great DX |
| Database | Supabase (PostgreSQL) | RLS, built-in auth, free tier |
| Auth | JWT | Stateless, mobile-friendly |
| EQS model | Claude Opus 4.7 | Best reasoning for rubric evaluation |
| Summary model | Claude Sonnet 4.6 | Fast + quality for summarisation |
| Concept model | Claude Opus 4.7 | Complex multi-step extraction |
| CI/CD | GitHub Actions | Native, free for public repos |

---

## Deployment Architecture

**Development:**
- Frontend: `localhost:3000` (Next.js dev server)
- Backend: `localhost:8000` (uvicorn --reload)
- Database: Supabase cloud (free tier)

**CI (GitHub Actions — ubuntu-latest):**
- Python 3.11, requirements-ci.txt (lightweight)
- `python -m pytest tests/ -v`
- `python -m flake8 . --select=E9,F63,F7,F82`

**Production:**
- Frontend: Vercel (auto-deploy on push to `main`)
- Backend: AWS Lambda (planned)
- Database: Supabase (production project, daily backups)

See `docs/GETTING_STARTED.md` for local development setup.
