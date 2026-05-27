# Vercel Deployment Guide

## Overview

LearnPath AI frontend is deployed on Vercel with automatic deployments on git push.

## Deployments

| Branch | Environment | URL |
|---|---|---|
| `main` | Production | https://learnpath-ai.vercel.app |
| any other | Preview | https://learnpath-ai-{hash}.vercel.app |

Trigger: git push → GitHub → Vercel webhook → build + deploy (~2-5 min).

## First-Time Setup

1. Go to vercel.com → **Add New Project**
2. Import your GitHub repo → select `learnpath-ai`
3. Set **Root Directory** to `frontend`
4. Framework auto-detected as **Next.js**
5. Add environment variables (see below) → **Deploy**

## Environment Variables in Vercel

Set these in **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your backend URL (or `http://localhost:8000` for preview) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uxlzoooxhaytosrlfszy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

Apply to: **Production + Preview + Development**

## GitHub Actions Deployment (CI/CD)

Add these secrets in **GitHub → Settings → Secrets → Actions**:

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | Vercel Dashboard → Settings → Tokens → Create |
| `VERCEL_PROJECT_ID` | Vercel Project → Settings → copy "Project ID" |
| `VERCEL_ORG_ID` | Vercel Account Settings → copy "Team ID" |

## Manual Deployment

```bash
npm i -g vercel
cd frontend
vercel        # preview deploy
vercel --prod # production deploy
```

## Rollback

1. Vercel Dashboard → **Deployments** tab
2. Find last good deployment
3. Click **...** → **Promote to Production**

Time to rollback: ~30 seconds.

## Troubleshooting

**Build fails with type errors:**
```bash
cd frontend
npm run build   # reproduce locally first
```

**Env vars undefined in browser:**
- Variable must be prefixed `NEXT_PUBLIC_`
- Redeploy after adding: Deployments → ... → Redeploy

**Slow builds:**
- Vercel caches `node_modules` automatically
- First build after dependency change is slow — expected
