# Packet 4.5 — Analytics & Usage Dashboard

**Status:** Shipped
**Stage:** 4 (Monetization layer)
**Depends on:** Packets 4.1–4.4

Comprehensive analytics derived live from existing event tables. Process-level
TTL cache prevents hammering the DB while keeping the admin dashboard responsive.

## What was built

### Backend

| File | Role |
|------|------|
| `services/analytics_service.py` | All metric computation; in-memory TTL cache (60–900 s by metric type); graceful zero-return on DB errors |
| `routers/analytics.py` | `/api/analytics/*` endpoints; all wrapped in try/except |
| `main.py` | Registers `/api/analytics` router |

### Frontend

| File | Role |
|------|------|
| `components/Analytics/MetricCard.tsx` | Reusable metric card with trend arrow and percentage change |
| `components/Analytics/RevenueChart.tsx` | Recharts line chart — 6-month revenue trend |
| `components/Analytics/CohortTable.tsx` | Retention cohort table with green/yellow/red color coding |
| `pages/admin/analytics.tsx` | Full admin dashboard: Overview / Revenue / Users / Personal tabs; auto-refreshes every 5 min |

### Tests

- `tests/unit/test_analytics.py` — 18 tests: TTL cache behaviour (set/get/expiry/invalidation), zero-analytics shape, cached second calls, all metric shapes via mocks, and DB-fail graceful degradation. No real DB.

## Metrics and data sources

All derived from existing tables — no analytics DB table is needed.

| Metric group | Source tables |
|-------------|---------------|
| User analytics | `path_sessions`, `question_answers`, `concept_progress` |
| Platform (users, activity) | `users`, `path_sessions` |
| Revenue (MRR, ARPU, trend) | `users.tier`, `transactions` |
| Churn | `subscriptions` (cancelled_at) |
| Retention cohorts | `users.created_at` + `path_sessions.started_at` |
| Engagement | `path_sessions` (session length, completion rate) |
| Funnel | `users` + `path_sessions` (signups → first video → paid) |
| Platform health | DB ping via `SELECT 1` |

## Cache TTLs

| Metric | TTL |
|--------|-----|
| User analytics | 60 s |
| Platform / revenue / churn / engagement | 300 s |
| Cohorts / funnel | 900 s |
| Platform health | 60 s |

## API endpoints

```
GET    /api/analytics/user        # personal analytics (60 s cache)
GET    /api/analytics/platform    # total users, activity, retention
GET    /api/analytics/revenue     # MRR, ARPU, 6-month trend
GET    /api/analytics/churn       # churn rate, at-risk users
GET    /api/analytics/cohorts     # retention cohort table
GET    /api/analytics/engagement  # session length, completion rate
GET    /api/analytics/funnel      # signup → video → paid conversion
GET    /api/analytics/health      # DB ping, cache stats
DELETE /api/analytics/cache       # admin: flush cache
```

## Design decisions vs. packet brief

| Packet spec | What was built | Reason |
|-------------|----------------|--------|
| `Analytics`, `PlatformAnalytics`, `ChurnReason` DB tables | No new tables | All metrics derived from existing event rows |
| Redis caching | In-memory TTL dict | No Redis in stack; same soft-fence pattern as cost_tracker |
| Daily computation job (APScheduler) | Not needed | On-demand with TTL cache replaces pre-computation; no DB table to write to |
| Funnel: home→signup→email→video→paid | signup→video→paid | Marketing landing page events not tracked yet |
| Churn reasons | `churn_reasons: {}` | No survey UI exists yet to collect them |
