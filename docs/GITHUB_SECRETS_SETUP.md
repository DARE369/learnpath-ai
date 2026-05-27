# GitHub Secrets Setup

## Purpose

GitHub Secrets store sensitive values (API keys, database URLs) securely. They are encrypted at rest, never logged in CI/CD output, and only accessible by authorized Actions.

## How to Add Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each item below

## Required Secrets

| Secret Name | Where to Get It |
|---|---|
| `DATABASE_URL` | Supabase Dashboard → Project Settings → Database → Connection string (URI) |
| `JWT_SECRET` | Generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `CLAUDE_API_KEY` | https://console.anthropic.com → API Keys |
| `YOUTUBE_API_KEY` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_API_KEY` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_GEMINI_API_KEY` | https://aistudio.google.com → Get API Key |
| `VERCEL_API_URL` | Your Vercel deployment URL (after frontend is deployed) |

## Using Secrets in GitHub Actions

Reference secrets in `.github/workflows/ci.yml` with `${{ secrets.SECRET_NAME }}`:

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
```

## Verify Secrets Are Working

After adding secrets and pushing to main:
1. Go to repo → **Actions** tab
2. Click the latest workflow run
3. Confirm no "secret not found" errors in the logs

## Environment vs Secret

| Use Environment Variable for... | Use Secret for... |
|---|---|
| App name, frontend URL | API keys, DB passwords |
| Feature flags | JWT secrets |
| Public config | OAuth credentials |
