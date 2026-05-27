# LearnPath AI - System Architecture

## High-Level Overview

LearnPath AI is a 3-tier application:

1. **Frontend (Next.js)** - User interface, browser-based
2. **Backend (FastAPI)** - API, business logic
3. **Database (Supabase/PostgreSQL)** - Data persistence

## Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER BROWSER                         │
│              (Next.js Frontend App)                     │
│  - Auth pages                                           │
│  - Learning session UI                                  │
│  - Dashboard                                            │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/HTTPS REST API
                         ▼
┌─────────────────────────────────────────────────────────┐
│            BACKEND API (FastAPI)                        │
│  - /api/auth/*    (signup, login, logout)               │
│  - /api/search/*  (search topics)                       │
│  - /api/session/* (learning sessions)                   │
│  - /api/progress/ (track progress)                      │
│                                                         │
│  Services:                                              │
│  - YouTube Service (search, transcripts)                │
│  - EQS Service    (scoring videos)                      │
│  - Summary Service (Claude integration)                 │
│  - Auth Service   (JWT tokens)                          │
└────────────────────────┬────────────────────────────────┘
                         │ SQL
                         ▼
┌─────────────────────────────────────────────────────────┐
│         DATABASE (Supabase/PostgreSQL)                  │
│  - Users table                                          │
│  - Topics table                                         │
│  - Videos table                                         │
│  - VideoScores table                                    │
│  - UserProgress table                                   │
│  - PathSessions table                                   │
└─────────────────────────────────────────────────────────┘

External APIs:
├── YouTube API   (search, transcripts)
├── Anthropic API (Claude - EQS, summaries)
└── Google API    (Gemini - fallback)
```

## Data Flow

### 1. User Search Flow

```
User types "Photosynthesis"
  ↓
Frontend: GET /api/search?topic=photosynthesis
  ↓
Backend:
  1. Check topic cache
  2. If cached → return immediately
  3. If not cached:
     a. YouTube API: search videos
     b. EQS Service: score each video
     c. Summary Service: generate summaries
     d. Concept Graph: extract concepts
     e. Path Assembly: order videos
     f. Store in cache
  4. Return path to frontend
  ↓
Frontend displays learning path
  ↓
User clicks "Start Learning"
```

### 2. Learning Session Flow

```
User starts session
  ↓
Frontend displays:
  - Video (YouTube IFrame)
  - Summary
  - Session controls
  ↓
User watches video + reads summary
  ↓
Video ends → Active recall question displayed
  ↓
User answers → Backend evaluates (Claude)
  ↓
Feedback displayed → User continues to next video
```

## Stage 0 Scope

**Exists after Stage 0:**
- GitHub repo with proper structure
- Environment configuration
- Supabase database with schema
- Vercel deployment setup
- FastAPI backend skeleton
- Documentation infrastructure

**Does NOT exist yet:**
- API endpoints (Stage 1)
- Frontend pages (Stage 2)
- Database population (Stage 1)
- User authentication (Stage 2)

## Technology Decisions

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| Frontend  | Next.js | SSR, SEO, fast deployment on Vercel |
| Backend   | FastAPI | Fast, modern, async support |
| Database  | Supabase | PostgreSQL + built-in auth + easy setup |
| Auth      | JWT | Stateless, mobile-friendly |
| AI        | Claude | Best quality for EQS, reasoning |

## Deployment Architecture

**Development:**
- Frontend: `localhost:3000` (Next.js dev)
- Backend: `localhost:8000` (FastAPI dev)
- Database: Supabase cloud (free tier)

**Staging:**
- Frontend: Vercel (preview branch)
- Backend: AWS Lambda (dev environment)
- Database: Supabase (staging database)

**Production:**
- Frontend: Vercel (main branch, auto-deploy)
- Backend: AWS Lambda (production environment)
- Database: Supabase (production database, backed up daily)

## Next Steps (Stage 1)

- Implement YouTube API integration
- Build EQS scoring engine
- Create summary generation service
- Build concept graph algorithm
- Implement path assembly

See `docs/GETTING_STARTED.md` for local development setup.
