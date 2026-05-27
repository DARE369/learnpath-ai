# Environment Setup Guide

## Overview

LearnPath AI uses environment variables for database connections, API keys, security settings, and feature flags.

## Backend Variables (`backend/.env`)

| Variable | Required | Example |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Yes | 32+ char random string |
| `CLAUDE_API_KEY` | Prod only | `sk-ant-...` |
| `YOUTUBE_API_KEY` | Prod only | `AIzaSy...` |
| `GOOGLE_API_KEY` | No | `AIzaSy...` |
| `GOOGLE_GEMINI_API_KEY` | No | `AIzaSy...` |
| `ENVIRONMENT` | No | `development` / `staging` / `production` |
| `DEBUG` | No | `true` / `false` |
| `LOG_LEVEL` | No | `DEBUG` / `INFO` / `WARNING` |
| `FRONTEND_URL` | No | `http://localhost:3000` |

## Frontend Variables (`frontend/.env.local`)

All browser-accessible variables must be prefixed with `NEXT_PUBLIC_`.

| Variable | Required | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJhbGciOi...` |

## Local Development Setup

```bash
# Backend
cd backend
# .env is already created with placeholder values
# Fill in DATABASE_URL and real API keys when ready
python scripts/validate_env.py

# Frontend
cd ../frontend
# .env.local is already created with placeholder values
# Fill in Supabase values from your Supabase dashboard
```

## Getting Required Values

**Supabase (DATABASE_URL + frontend keys):**
1. Go to supabase.com → create project "learnpath-ai"
2. Project Settings → Database → Connection string (URI) → `DATABASE_URL`
3. Project Settings → API → Project URL → `NEXT_PUBLIC_SUPABASE_URL`
4. Project Settings → API → anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Claude API:**
- https://console.anthropic.com → API Keys → Create key

**YouTube API:**
- https://console.cloud.google.com → Enable YouTube Data API v3 → Credentials → Create API key

## Production (GitHub Secrets)

See `docs/GITHUB_SECRETS_SETUP.md` for CI/CD secrets configuration.

## Security Rules

1. Never commit `.env` or `.env.local` files (`.gitignore` blocks this)
2. Never log API keys or secrets
3. Use separate keys for dev and production
4. Rotate secrets every 90 days (see `docs/SECRETS_ROTATION.md`)
