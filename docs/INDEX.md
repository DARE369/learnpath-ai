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
- ⬜ Learning sessions
- ⬜ Progress tracking
- ⬜ Active recall

### Stage 3-7
- ⬜ Intelligence features
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

**Last updated:** May 28, 2026
**Status:** 🔄 Stage 2 in progress — Packet 2.1 (Authentication) complete
