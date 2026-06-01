# LearnPath AI Documentation Index

## Getting Started

- **[Getting Started](GETTING_STARTED.md)** - Local development setup
- **[Architecture](ARCHITECTURE.md)** - System design and components
- **[Environment Setup](ENVIRONMENT_SETUP.md)** - Environment variables guide

## Deployment

- **[Vercel Deployment](DEPLOYMENT_VERCEL.md)** - Frontend deployment
- **[Database Backup](DATABASE_BACKUP.md)** - Backup and recovery procedures

## API Documentation

- **[API Specification](API_SPEC.md)** - All endpoints documented
- **[API Documentation Auto-Generated](../backend/docs)** - Full OpenAPI spec (auto-generated)

## Feature Documentation

- **[Authentication](AUTHENTICATION.md)** - JWT auth, signup/login flows
- **[Learning Sessions](LEARNING_SESSIONS.md)** - Video tracking, session lifecycle, API endpoints
- **[Active Recall](ACTIVE_RECALL.md)** - Question generation, answer evaluation, spaced repetition
- **[Concept Branching](CONCEPT_BRANCHING.md)** - Progressive learning branches per concept (Packet 3.1)
- **[Blacklist System](BLACKLIST_SYSTEM.md)** - Soft/hard video quality control with shadow testing (Packet 3.2)
- **[Expanded Confidence Scoring](CONFIDENCE_SCORING_EXPANDED.md)** - 11-criteria EQS (0–170) with score-dependent cache TTL (Packet 3.3)
- **[Auto-Remediation](AUTO_REMEDIATION.md)** - 3-tier fallback (Claude → Gemini → original) for low-confidence paths (Packet 3.4)
- **[Self-Building Mechanism](SELF_BUILDING_MECHANISM.md)** - Nightly job: dedup, keyword indexing, popular-topic expansion (Packet 3.5)

## Database

- **[Database Schema](DATABASE_SCHEMA.md)** - Table definitions and relationships
- **[Database Backup](DATABASE_BACKUP.md)** - Backup strategies

## Development

- **[Contributing](CONTRIBUTING.md)** - Code standards and guidelines
- **[GitHub Secrets Setup](GITHUB_SECRETS_SETUP.md)** - CI/CD secrets
- **[Secrets Rotation](SECRETS_ROTATION.md)** - Key rotation policy

## Architecture Decisions

- **[ADR-001: Database Technology](decisions/ADR_001_database_technology.md)** - Why PostgreSQL/Supabase

## Build Stages

### Stage 0: Foundation (Current)
- ✅ Repository setup
- ✅ Environment configuration
- ✅ Database schema
- ✅ Frontend deployment
- ✅ Backend skeleton

### Stage 1: Core Pipeline
- ✅ YouTube integration (Packet 1.1)
- ✅ EQS engine (Packet 1.2)
- ✅ Summary generation (Packet 1.3)
- ✅ Concept graph (Packet 1.4)
- ✅ Path assembly (Packet 1.5)
- ✅ Two-layer caching (Packet 1.6)

### Stage 2: User Layer
- ✅ Authentication (Packet 2.1) — JWT + bcrypt, signup/login/refresh/logout/me, premium auth UI
- ✅ Learning Sessions & Video Tracking (Packet 2.2) — custom video player, progress tracking, concept sidebar, session API
- ✅ User Progress Dashboard (Packet 2.3) — stats cards, activity heatmap, progress chart, achievements, recommended courses, recent activity feed
- ✅ Active Recall & AI Grading (Packet 2.4) — Claude-powered question generation, answer evaluation, spaced repetition scheduling
- ✅ User Journey Integration (Packet 2.5) — Navbar, useAuth/useProgress contexts, explore/courses/settings pages, route protection

### Stage 3: Intelligence Layer
- ✅ Concept Branching (Packet 3.1) — Claude Opus splits each concept into 3–5 progressive branches; DB-cached for 30 days; per-feature daily budget enforced
- ✅ Blacklist System (Packet 3.2) — soft/hard video blacklist with 90-day soft retry, shadow testing for 1-in-10 users, auto-blacklist on EQS<65 during search, admin dashboard, EQS re-eval budget-gated
- ✅ Expanded Confidence Scoring (Packet 3.3) — 11-criteria EQS (4 base + 7 bonus, 0–170 points), 5 confidence levels, score-dependent cache TTL (0/7/14/30/60d), expanded_video_scores table, confidence dashboard; coexists with legacy 0–100 EQS, pipeline migration deferred
- ✅ Auto-Remediation (Packet 3.4) — opt-in 3-tier fallback (Claude variants → Gemini variants → original) when path avg score < 60; remediation_events log + admin /stats; RemediationNotification modal mounted in SearchTopicForm; budget-gated via cost_tracker("remediation")
- ✅ Self-Building Mechanism (Packet 3.5) — nightly AsyncIOScheduler job (2 AM UTC, env-gated) that dedups searches via Claude clustering, extracts keywords for popular topics, and auto-expands via branching_service; SearchEvent log added; TopicAlias / TopicKeyword / NightlyRun tables; admin dashboard at /admin/expansion with Run-now

### Stage 4-7
- ⬜ Monetization
- ⬜ B2B features
- ⬜ Polish & deployment

## Technology Stack

### Frontend
- Next.js 14+
- React 18+
- TypeScript
- Tailwind CSS
- Vercel

### Backend
- FastAPI
- Python 3.11+
- SQLAlchemy
- Pydantic

### Database
- PostgreSQL (Supabase)
- Redis (future)

### AI
- Claude (Anthropic)
- Gemini (Google)

### Infrastructure
- Vercel (frontend)
- AWS Lambda (backend)
- Supabase (database)
- GitHub Actions (CI/CD)

## Common Tasks

### Running Locally
```bash
# Backend
cd backend
source venv/bin/activate
./run.sh

# Frontend (new terminal)
cd frontend
npm run dev
```

### Deploying
- Frontend: Push to `main` → auto-deployed to Vercel
- Backend: Push to `main` → deploy via GitHub Actions
- Database: Migrations auto-applied

### Testing
```bash
# Backend tests
cd backend
pytest tests/

# Frontend tests
cd frontend
npm test
```

### Creating New Feature
1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Test locally
4. Commit: `git commit -am "feat: add my feature"`
5. Push: `git push origin feature/my-feature`
6. Create Pull Request
7. Wait for CI/CD checks
8. Code review
9. Merge

## Troubleshooting

- **Database connection error?** See [Environment Setup](ENVIRONMENT_SETUP.md)
- **Frontend not deploying?** See [Vercel Deployment](DEPLOYMENT_VERCEL.md)
- **Backend won't start?** Check Python venv is activated and dependencies installed
- **API endpoints not working?** Check .env has DATABASE_URL and API keys

## Getting Help

1. Check relevant documentation above
2. Search GitHub issues
3. Ask on team chat
4. Create GitHub issue

## Contributing

See [Contributing](CONTRIBUTING.md) for code standards and process.

---

**Last updated:** May 30, 2026
**Status:** ✅ Stage 3 complete — all 5 packets (3.1 Concept Branching, 3.2 Blacklist System, 3.3 Expanded Confidence Scoring, 3.4 Auto-Remediation, 3.5 Self-Building Mechanism) shipped


## Stage 4 - Monetization Layer

- 4.1 Payment System & Subscription Models - Flutterwave checkout, Free/Pro/Premium
  plans (NGN), usage limits, pro-rated upgrades, queued downgrades, auto-renewal,
  billing history. See [PACKET_4_1_PAYMENT_SYSTEM.md](PACKET_4_1_PAYMENT_SYSTEM.md)
  and [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md).

- 4.2 Usage Limits & Rate Limiting -- per-plan monthly video/hour quotas
  and hourly/daily endpoint rate limits. Enforced at session start, question
  evaluate, and search build-path. `UsageAlert` on dashboard warns at 80%.
  See [PACKET_4_2_USAGE_LIMITS.md](PACKET_4_2_USAGE_LIMITS.md).

- 4.3 Free Tier Experience -- upgrade CTAs (AdBanner, UpgradePrompt), success
  stories widget, feature-availability gate. No DB tables; CTAs are hardcoded
  internal prompts, not third-party ads. See [PACKET_4_3_FREE_TIER.md](PACKET_4_3_FREE_TIER.md).

- 4.4 Feature Unlock System -- `FeatureUnlockService` with per-feature benefit
  lists and promo payloads; `FeatureLock` (in-context lock card) and
  `FeatureMatrix` (comparison table, embedded on billing page).
  See [PACKET_4_4_FEATURE_UNLOCK.md](PACKET_4_4_FEATURE_UNLOCK.md).

- 4.5 Analytics & Usage Dashboard -- `AnalyticsService` derives all metrics
  from existing event tables (no analytics DB table); in-memory TTL cache
  (60-900 s). Admin dashboard at `/admin/analytics` with tabs for Overview,
  Revenue, Users, Personal; recharts line chart and cohort retention table.
  See [PACKET_4_5_ANALYTICS.md](PACKET_4_5_ANALYTICS.md).
