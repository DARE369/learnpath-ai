# LearnPath AI Documentation

Welcome! This folder contains all documentation for LearnPath AI.

## Quick Links

- **[Start here: INDEX.md](INDEX.md)** — Documentation index
- **[Getting Started](GETTING_STARTED.md)** — Set up locally
- **[Architecture](ARCHITECTURE.md)** — How the system works
- **[API Spec](API_SPEC.md)** — All endpoints

## For Different Roles

### Developers
1. Read [Getting Started](GETTING_STARTED.md)
2. Read [Architecture](ARCHITECTURE.md)
3. Read [Contributing](CONTRIBUTING.md)
4. Check [API Spec](API_SPEC.md) for endpoints

### DevOps / Infrastructure
1. Read [Environment Setup](ENVIRONMENT_SETUP.md)
2. Read [Deployment Vercel](DEPLOYMENT_VERCEL.md)
3. Read [Database Backup](DATABASE_BACKUP.md)
4. Check [GitHub Secrets Setup](GITHUB_SECRETS_SETUP.md)

### Product / Leadership
1. Read [Architecture](ARCHITECTURE.md) for overview
2. Check [Build Stages](#build-stages) for progress
3. Review [API Spec](API_SPEC.md) for capabilities

### New Team Members
1. [Getting Started](GETTING_STARTED.md) (15 min)
2. [Architecture](ARCHITECTURE.md) (20 min)
3. [Contributing](CONTRIBUTING.md) (10 min)
4. Pick a task and start coding!

## Build Stages

### ✅ Stage 0: Foundation (Complete)
- Repository setup
- Environment configuration
- Database schema
- Frontend deployment
- Backend skeleton

### 🔄 Stage 1: Core Pipeline (Next)
- YouTube integration
- EQS engine
- Summary generation
- Path assembly

### ⬜ Stage 2-7: Future stages
- User authentication
- Learning sessions
- Intelligence features
- Monetization
- B2B features

## Documentation Structure

```
docs/
├── INDEX.md                          (start here)
├── README.md                         (this file)
├── GETTING_STARTED.md
├── ARCHITECTURE.md
├── API_SPEC.md
├── DATABASE_SCHEMA.md
├── DATABASE_BACKUP.md
├── ENVIRONMENT_SETUP.md
├── GITHUB_SECRETS_SETUP.md
├── SECRETS_ROTATION.md
├── DEPLOYMENT_VERCEL.md
├── CONTRIBUTING.md
├── DOCUMENTATION_STYLE.md
├── DOCUMENTATION_CHECKLIST.md
└── decisions/
    └── ADR_001_database_technology.md
```

## Common Tasks

### I want to...

**...set up for local development**
→ [Getting Started](GETTING_STARTED.md)

**...understand the system**
→ [Architecture](ARCHITECTURE.md)

**...add a new API endpoint**
→ [Contributing](CONTRIBUTING.md) + [API Spec](API_SPEC.md)

**...deploy the frontend**
→ [Deployment Vercel](DEPLOYMENT_VERCEL.md)

**...fix a database issue**
→ [Database Backup](DATABASE_BACKUP.md)

**...rotate API keys**
→ [Secrets Rotation](SECRETS_ROTATION.md)

**...understand the database**
→ [Database Schema](DATABASE_SCHEMA.md)

**...set up GitHub Secrets**
→ [GitHub Secrets Setup](GITHUB_SECRETS_SETUP.md)

## Contributing to Documentation

1. Update docs when you change code (same PR)
2. Follow [Documentation Style Guide](DOCUMENTATION_STYLE.md)
3. Keep examples up-to-date
4. Cross-link related docs
5. Archive old docs (don't delete)

## Asking for Help

1. Check [INDEX.md](INDEX.md) — probably there
2. Search GitHub issues
3. Ask on team chat with link to relevant doc
4. Create GitHub issue if doc is wrong/missing

---

**Status:** 🚀 Stage 0 Complete
**Last updated:** May 27, 2026
**Next update:** When Stage 1 begins
