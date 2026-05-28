# Environment Setup Guide

## Overview

LearnPath AI uses environment variables for database connections, API keys, and configuration. Variables live in local `.env` files that are **never committed** (blocked by `.gitignore`).

---

## Backend Variables (`backend/.env`)

| Variable | Required | Stage needed | Example |
|---|---|---|---|
| `DATABASE_URL` | **Always** | 0+ | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | **Always** | 0+ | 32+ char random string |
| `YOUTUBE_API_KEY` | Stage 1+ | 1+ | `AIzaSy...` |
| `CLAUDE_API_KEY` | Stage 1+ | 1+ | `sk-ant-...` |
| `GOOGLE_API_KEY` | Optional | future | `AIzaSy...` |
| `GOOGLE_GEMINI_API_KEY` | Optional | future | `AIzaSy...` |
| `ENVIRONMENT` | No | — | `development` / `staging` / `production` |
| `DEBUG` | No | — | `true` / `false` |
| `LOG_LEVEL` | No | — | `DEBUG` / `INFO` / `WARNING` |
| `FRONTEND_URL` | No | — | `http://localhost:3000` |
| `SUPABASE_URL` | Optional | future | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Optional | future | `eyJhbGc...` |
| `SUPABASE_SERVICE_KEY` | Optional | future | `eyJhbGc...` |

> **Stage 1 note:** `YOUTUBE_API_KEY` and `CLAUDE_API_KEY` are needed for the pipeline
> endpoints to work. Without them, endpoints return `400 Bad Request`. The server
> still starts and all unit tests still pass without them.

### Minimum `backend/.env` for local development

```env
DATABASE_URL=postgresql://user:pass@localhost/learnpath
JWT_SECRET=replace-with-32-char-random-string-here
ENVIRONMENT=development
DEBUG=true
YOUTUBE_API_KEY=AIzaSy...
CLAUDE_API_KEY=sk-ant-...
```

---

## Frontend Variables (`frontend/.env.local`)

All browser-accessible variables must be prefixed with `NEXT_PUBLIC_`.

| Variable | Required | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJhbGciOi...` |

---

## Getting the Required Values

### Supabase (DATABASE_URL + frontend keys)
1. Go to [supabase.com](https://supabase.com) → create project `learnpath-ai`
2. **Database URL:** Project Settings → Database → Connection string (URI) → `DATABASE_URL`
3. **Frontend URL:** Project Settings → API → Project URL → `NEXT_PUBLIC_SUPABASE_URL`
4. **Anon key:** Project Settings → API → anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Claude API Key (`CLAUDE_API_KEY`)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create key
3. Copy to `backend/.env` as `CLAUDE_API_KEY=sk-ant-...`

**Models used in Stage 1:**
- `claude-opus-4-7` — EQS scoring, concept graph extraction
- `claude-sonnet-4-6` — Summary generation

### YouTube API Key (`YOUTUBE_API_KEY`)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable **YouTube Data API v3**
3. Credentials → Create Credentials → API key
4. Restrict key to YouTube Data API v3
5. Copy to `backend/.env` as `YOUTUBE_API_KEY=AIzaSy...`

---

## Production / CI Environment (GitHub Secrets)

See [GitHub Secrets Setup](GITHUB_SECRETS_SETUP.md) for CI/CD configuration.

In production, all variables are passed as environment variables (not `.env` files).
The CI `test-backend` job uses these secrets:

| Secret | Used for |
|---|---|
| `DATABASE_URL` | Backend database connection |
| `JWT_SECRET` | Token signing |
| `VERCEL_TOKEN` | Frontend deployment |
| `VERCEL_PROJECT_ID` | Vercel project identifier |
| `VERCEL_ORG_ID` | Vercel org identifier |

---

## Validation

Run the validation script after setting up your `.env`:

```bash
cd backend
python scripts/validate_env.py
```

---

## Security Rules

1. **Never commit** `.env` or `.env.local` — `.gitignore` blocks this
2. **Never log** API keys or JWT secrets (even in debug mode)
3. Use **separate keys** for development and production
4. **Rotate secrets** every 90 days — see [Secrets Rotation](SECRETS_ROTATION.md)
5. **Restrict API keys** at the provider level (e.g. restrict YouTube key to your domain)
