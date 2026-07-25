# Backend Deployment — Fly.io

The LearnPath AI backend (FastAPI, Python 3.11) runs on **Fly.io** as of
2026-07-25, migrated off Railway to cut cost while keeping the exact same
always-on execution model (schedulers + WebSockets + in-memory state all
intact). Serverless (Supabase Edge Functions) was evaluated and rejected — it
can't run a stateful long-running Python monolith; see the cost-analysis notes.

## Topology

- **App name:** `learnpath-ai-backend`
- **URL:** https://learnpath-ai-backend.fly.dev
- **Region:** `fra` (Frankfurt) — co-located with the Supabase Postgres
  (eu-central-1) so DB round-trips are local.
- **Machine:** 1 × `shared-cpu-1x` / 512MB, **always-on**
  (`min_machines_running = 1`, `auto_stop_machines = off`).
- **Why exactly one machine:** the app keeps in-process state (cost_tracker
  daily budgets, rate limiter, cache L1, the WebSocket connection registry) and
  runs the path-adaptation APScheduler in-process. A second machine would split
  that state and double-run the scheduler. Scaling out horizontally needs Redis
  first (tracked in the ops ledger). `fly launch` defaults to 2 machines for HA —
  we ran `fly scale count 1` to correct that.

## Build

- **Dockerfile** (`backend/Dockerfile`) — replaces Railway's `nixpacks.toml`.
  Installs the system binaries the app needs: `tesseract-ocr` + `poppler-utils`
  (OCR for NEW-PACKET-E) and `ffmpeg` (Whisper/Groq audio transcript fallback).
  Python pinned to 3.11.9 (wheels for anthropic/anyio don't exist on 3.14).
- Single uvicorn worker (`--host 0.0.0.0 --port ${PORT:-8080}`) — protects the
  in-process state above.
- `nixpacks.toml` and `Procfile` are left in the repo (Railway-only; Fly ignores
  them) — remove once Railway is fully decommissioned.

## Config (`backend/fly.toml`)

- `internal_port = 8080`, `force_https = true`
- Health check: GET `/health` every 30s (the app's own route in `main.py`)
- `[[vm]]` shared-cpu-1x / 512mb — bump `memory` to `1024mb` if OCR/Whisper on
  large PDFs/audio OOMs (`pdf2image` + `ffmpeg` are the memory-hungry paths).

## Secrets

Set via `fly secrets set` or the Fly dashboard (Secrets tab). Injected at boot.

**Required (missing any → `sys.exit(1)` at boot, per config_validator):**
- `DATABASE_URL` — **must be the Supabase Session-pooler URL**
  (`aws-1-eu-central-1.pooler.supabase.com:5432`, user `postgres.<PROJECT_REF>`).
  NOT the direct `db.<ref>.supabase.co` host — Fly's network is IPv6-first and
  the direct host needs the IPv4 add-on the free tier lacks.
- `ENVIRONMENT` = `production`
- `JWT_SECRET` (alias `JWT_SECRET_KEY` also accepted)
- `FRONTEND_URL` = the Vercel URL (auto-added to CORS `ALLOWED_ORIGINS`)

**Optional (degrade gracefully if unset):** `CLAUDE_API_KEY`, `YOUTUBE_API_KEY`,
`GROQ_API_KEY`, `GOOGLE_CLIENT_ID`/`SECRET`, `GOOGLE_GEMINI_API_KEY`,
`SUPABASE_*`, `ADMIN_EMAILS`, `FLUTTERWAVE_*` (payments no-op without them),
`SENTRY_DSN`, `RESEND_API_KEY`/`SENDGRID_API_KEY`, `EXPANSION_SCHEDULER_ENABLED`,
`PATH_ADAPTATION_ENABLED`.

## Deploy / redeploy

```bash
cd backend
fly deploy          # builds the Dockerfile, pushes image, restarts the machine
```

## Verify a healthy boot

```bash
curl.exe -i https://learnpath-ai-backend.fly.dev/health   # -> 200 {"status":"ok",...}
fly status                                                 # 1 machine, started, passing
fly logs                                                   # watch the boot sequence
```

Good boot log sequence:
`Running startup configuration checks...` → `Configuration/Database: ✓ PASS` →
`Database tables ensured (create_all complete)` → `Schema patches: N/N applied` →
`Auto-adaptation scheduled` → `Application startup complete`.

## Frontend cutover (Vercel)

After the backend `/health` is green:
1. Set `NEXT_PUBLIC_API_URL` = `https://learnpath-ai-backend.fly.dev` in Vercel.
2. **Redeploy the frontend** — this var is inlined at build time, so a redeploy
   is mandatory, not optional (a stale build keeps probing the old URL).
3. Confirm the live app works end-to-end, then delete the Railway service to
   stop its billing (keep it until verified, for rollback).
