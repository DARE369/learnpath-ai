# Packet 4.2 — Usage Limits & Rate Limiting

**Status:** Shipped
**Stage:** 4 (Monetization layer)
**Depends on:** Packet 4.1 (subscription plans)

Enforces per-plan monthly video/hour quotas and per-day/hour endpoint rate
limits. Usage is derived live from existing event tables — no separate counter
table is needed, so limits reset automatically at period boundaries and cannot
be bypassed from the client.

## What was built

### Backend

| File | Role |
|------|------|
| `services/usage_tracking_service.py` | Derives usage from `path_sessions` + `question_answers`; `check_limit` / `enforce_limit` for "watch_video", "learn_hours", "answer_question" |
| `services/rate_limiting_service.py` | In-memory sliding-window counters; `check_and_increment` / `enforce` for search and question-evaluate endpoints |
| `routers/usage.py` | `/api/usage/current`, `/api/usage/percentage`, `/api/usage/limits`, `/api/usage/check` |
| `routers/session.py` | `POST /start` — enforces monthly video limit (429 if exceeded) |
| `routers/questions.py` | `POST /evaluate` — enforces daily question rate limit (429 if exceeded) |
| `routers/search.py` | `POST /build-path` — enforces hourly search rate limit (429 if exceeded) |
| `main.py` | Registers `/api/usage` router |

### Frontend

| File | Role |
|------|------|
| `components/Billing/UsageCard.tsx` | Per-metric progress bars (green/yellow/red by threshold) |
| `components/Billing/UsageAlert.tsx` | Dismissable alert shown when any metric >= 80% |
| `pages/dashboard.tsx` | Loads `/api/usage/current` on mount; renders `UsageAlert` at page top |

### Tests

- `tests/unit/test_usage_tracking.py` — 23 tests covering quota checks, limit enforcement, rate-window logic, premium-unlimited paths, degradation on error, and per-plan question/search limits. No DB or network.

## Limit catalogue

### Monthly quotas (via UsageTrackingService)

| Plan    | Videos/mo | Hours/mo | Questions/day |
|---------|-----------|----------|---------------|
| Free    | 10        | 10       | 5             |
| Pro     | 100       | 100      | 20            |
| Premium | Unlimited | Unlimited| Unlimited     |

Usage is derived from:
- **Videos** — `path_sessions` rows where `video_watched = True` since month start.
- **Hours** — `SUM(total_watch_time_seconds) / 3600` since month start.
- **Questions** — `question_answers` rows created since midnight UTC.

No extra cron job needed; the month boundary is implicit in the SQL date filter.

### Per-endpoint rate limits (via RateLimitingService, in-memory)

| Endpoint | Free | Pro | Premium | Window |
|----------|------|-----|---------|--------|
| `search:build-path` | 2/hr | 10/hr | Unlimited | Hourly |
| `questions:evaluate` | 5/day | 20/day | Unlimited | Daily |

In-memory design: same soft-fence pattern as `cost_tracker`. Resets on redeploy,
which is acceptable — not a billing rail. Windows are wall-clock aligned (UTC).

## Enforcement

All three enforcement points share the same pattern:

```
try:
    check -> if not allowed: raise HTTPException(429, detail, headers)
except HTTPException: raise
except Exception: log + degrade to "allowed"  # monitoring failures never block users
```

Response headers on 429:
- `Retry-After: <seconds>`
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: <ISO datetime>`

## Frontend alerts

`UsageAlert` fires when any metric crosses **80%**. It picks the highest-severity
metric (by percentage) and shows a single, dismissable banner. At 95%+ the
message is "critical"; at 100% it says "reached your limit." In all cases an
"Upgrade" button deep-links to `/billing`.

## API endpoints

```
GET  /api/usage/current      # full usage + plan limits for this month
GET  /api/usage/percentage   # compact {videos, hours, questions, overall} %
GET  /api/usage/limits       # plan limits + per-endpoint rate limits
POST /api/usage/check        # {action_type} -> {allowed, reason, remaining}
```

## Design decisions vs. packet brief

| Packet spec | What was built | Reason |
|-------------|----------------|--------|
| Separate `usage_tracking` + `rate_limit_tracking` DB tables | No new tables | Usage derived from existing event rows (bypass-proof, self-resetting); in-memory rate limits (soft fence, same as `cost_tracker`) |
| Redis for rate limiting | In-memory dict | Redis not in the stack; in-memory is consistent with the codebase pattern |
| Monthly reset cron job | Not needed | SQL date filter makes counters self-resetting at month boundaries |
| `async def` throughout | Sync methods (DB) + in-memory | Session router is sync; only the network-calling services use async |
