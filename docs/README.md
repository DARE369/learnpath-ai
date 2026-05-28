# LearnPath AI Documentation

Welcome! This folder contains all documentation for LearnPath AI.

## Quick Links

- **[Start here: INDEX.md](INDEX.md)** — Documentation index and progress tracker
- **[Getting Started](GETTING_STARTED.md)** — Set up locally in 10 minutes
- **[Architecture](ARCHITECTURE.md)** — How the system works
- **[API Spec](API_SPEC.md)** — All live endpoints with examples

---

## For Different Roles

### Developers
1. [Getting Started](GETTING_STARTED.md)
2. [Architecture](ARCHITECTURE.md)
3. [Contributing](CONTRIBUTING.md)
4. [API Spec](API_SPEC.md) — endpoints and request/response shapes

### DevOps / Infrastructure
1. [Environment Setup](ENVIRONMENT_SETUP.md)
2. [Vercel Deployment](DEPLOYMENT_VERCEL.md)
3. [Database Backup](DATABASE_BACKUP.md)
4. [GitHub Secrets Setup](GITHUB_SECRETS_SETUP.md)

### Product / Leadership
1. [Architecture](ARCHITECTURE.md) — system overview
2. [INDEX.md](INDEX.md) — build-stage progress
3. [API Spec](API_SPEC.md) — current capabilities

### New Team Members
1. [Getting Started](GETTING_STARTED.md) — 15 min
2. [Architecture](ARCHITECTURE.md) — 20 min
3. [Contributing](CONTRIBUTING.md) — 10 min
4. Pick a task and start coding!

---

## Build Stages

### ✅ Stage 0: Foundation (Complete)
- Repository setup and branch protection
- Environment configuration
- Supabase database schema
- Vercel deployment pipeline
- FastAPI backend skeleton
- CI/CD with GitHub Actions

### 🔄 Stage 1: Core Pipeline (In Progress)
- ✅ YouTube integration (Packet 1.1)
- ✅ EQS scoring engine (Packet 1.2)
- ✅ Summary generation (Packet 1.3)
- ✅ Concept graph + topological sort (Packet 1.4)
- ✅ Path assembly & ranking (Packet 1.5)
- 🔄 Caching layer (Packet 1.6)

### ⬜ Stage 2: User Layer
- Authentication (JWT + Supabase Auth)
- Learning sessions
- Progress tracking
- Active recall

### ⬜ Stage 3–7: Future
- Intelligence features
- Monetisation
- B2B features
- Polish & scale

---

## Documentation Structure

```
docs/
├── INDEX.md                          ← start here (progress tracker)
├── README.md                         ← this file
├── GETTING_STARTED.md                ← local dev setup
├── ARCHITECTURE.md                   ← system design
├── API_SPEC.md                       ← all endpoints
├── DATABASE_SCHEMA.md                ← table definitions
├── DATABASE_BACKUP.md                ← backup procedures
├── ENVIRONMENT_SETUP.md              ← env variables guide
├── GITHUB_SECRETS_SETUP.md           ← CI/CD secrets
├── SECRETS_ROTATION.md               ← key rotation policy
├── DEPLOYMENT_VERCEL.md              ← frontend deployment
├── CONTRIBUTING.md                   ← code standards
├── DOCUMENTATION_STYLE.md            ← doc style guide
├── DOCUMENTATION_CHECKLIST.md        ← PR checklist
└── decisions/
    └── ADR_001_database_technology.md
```

---

## Common Tasks

| I want to… | Go to |
|---|---|
| Set up locally | [Getting Started](GETTING_STARTED.md) |
| Understand the system | [Architecture](ARCHITECTURE.md) |
| Add a new API endpoint | [Contributing](CONTRIBUTING.md) + [API Spec](API_SPEC.md) |
| Deploy the frontend | [Vercel Deployment](DEPLOYMENT_VERCEL.md) |
| Fix a database issue | [Database Backup](DATABASE_BACKUP.md) |
| Rotate API keys | [Secrets Rotation](SECRETS_ROTATION.md) |
| Understand the schema | [Database Schema](DATABASE_SCHEMA.md) |
| Set up GitHub Secrets | [GitHub Secrets Setup](GITHUB_SECRETS_SETUP.md) |

---

## Contributing to Documentation

1. **Update docs in the same PR as code changes** — never leave docs behind
2. Follow the [Documentation Style Guide](DOCUMENTATION_STYLE.md)
3. Use the [Documentation Checklist](DOCUMENTATION_CHECKLIST.md) before submitting a PR
4. Keep examples runnable and up-to-date
5. Cross-link related docs

---

**Status:** 🔄 Stage 1 in progress — Packets 1.1–1.5 complete
**Last updated:** May 28, 2026
