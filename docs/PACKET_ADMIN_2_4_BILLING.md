# ADMIN-2.4 — Financial & Billing (Mocked)

## Overview

School billing management: plan overview, usage tracking, 90-day forecast, plan
comparison and upgrade, invoice history with print/email. **All charges are
mocked — no real payment integration.** The focus is billing logic, audit trail,
and demo resilience.

## Pages

| Route | Purpose |
|-------|---------|
| `/school/billing/plan` | Current plan, usage bars, forecast, recommended upgrade |
| `/school/billing/invoices` | Invoice history with download and email |
| `/school/billing` | Redirects → `/school/billing/plan` |

## Database Tables

### `school_billing_plans`
Plan catalogue (Starter / Pro / Enterprise). Populated by `seed_plans()`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `plan_slug` | String(50) UNIQUE | e.g. `starter`, `pro`, `enterprise` |
| `plan_name` | String(100) | Display name |
| `description` | Text | |
| `monthly_price` | Numeric(10,2) | |
| `annual_price` | Numeric(10,2) | |
| `features` | JSON | limits + flags (see below) |
| `is_active` | Boolean | |
| `display_order` | Integer | |

`features` schema:
```json
{
  "max_teachers": 50,
  "max_students": 2000,
  "max_classes": 100,
  "storage_gb": 100,
  "max_api_calls": 1000000,
  "sso": false,
  "advanced_analytics": false,
  "support": "email"
}
```

### `school_billing_subscriptions`
One row per school (unique on `school_id`).

| Column | Type | Notes |
|--------|------|-------|
| `school_id` | UUID UNIQUE FK | organizations.id |
| `plan_id` | UUID FK | school_billing_plans.id |
| `billing_cycle` | String | `monthly` / `annual` |
| `status` | String | `active` / `cancelled` |
| `auto_renew` | Boolean | |
| `renews_at` | DateTime | first of next month |
| `max_teachers/students/classes` | Integer | denormalised from plan |
| `max_storage_gb` | Numeric(10,2) | |
| `max_api_calls` | Integer | |
| `billing_contact_email` | String | used for email_invoice |

### `school_billing_invoices`
One row per billing period or upgrade proration event.

| Column | Type | Notes |
|--------|------|-------|
| `invoice_number` | String(50) UNIQUE | `INV-YYYY-MM-XXXX` |
| `invoice_date` | Date | |
| `billing_period_start/end` | Date | |
| `subtotal/tax/total` | Numeric(10,2) | |
| `status` | String | `paid` / `pending` |
| `line_items` | JSON | list of `{description, quantity, unit_price, total}` |
| `paid_at` | DateTime | |
| `email_sent_to` | String | set by email_invoice |

### `school_billing_settings`
Optional per-school overrides. One row per school (unique on `school_id`).

## Backend

### `backend/services/billing_service.py`

`BillingService` singleton (`billing_service`).

#### Key methods

| Method | Description |
|--------|-------------|
| `seed_plans(db)` | Idempotent — creates the 3 plan rows if missing |
| `get_plans(db)` | Returns formatted plan list (calls seed first) |
| `get_overview(db, user_id, school_id)` | subscription + usage + forecast + recent_invoices |
| `get_plan_comparison(db, user_id, school_id)` | all plans with `is_current`, `additional_monthly`, `limit_warnings` |
| `upgrade_plan(db, user_id, school_id, plan_slug, billing_cycle)` | updates sub, generates proration invoice, logs |
| `list_invoices(db, user_id, school_id, page, page_size)` | paginated invoice list |
| `get_invoice_detail(db, user_id, school_id, invoice_id)` | single invoice with line items |
| `email_invoice(db, user_id, school_id, invoice_id, to_email?)` | marks `email_sent_to`/`email_sent_at`, no real email sent |
| `update_billing_settings(db, user_id, school_id, data)` | upsert SchoolBillingSettings |

#### Demo seeding

`_get_or_create_subscription(db, school_id)` auto-creates a **Pro subscription**
and seeds **12 months of historical paid invoices** for any school that doesn't
have one yet. This makes the UI work immediately in demo/dev without any manual setup.

#### Usage computation (`_compute_usage`)
- Teachers: `COUNT(teachers WHERE school_id = ?)`
- Students: distinct `student_id` from `class_memberships JOIN classes` where class is active
- Classes: `COUNT(classes WHERE school_id = ?)`
- Storage: mocked as `1.0 + teachers * 0.3 + students * 0.01` GB
- API calls: count from `school_activity_log` in current calendar month

#### Forecast (`_compute_forecast`)
Linear 90-day projection:
- Students: 5%/month growth
- Teachers: 2%/month growth
- Classes: 1%/month growth

Issues a `warning` at 85% of limit, `critical` at 95%.

#### Proration formula
```
proration = (new_monthly_price - current_monthly_price) / 30 × days_remaining_in_cycle
```
A negative proration (downgrade) is recorded as a credit invoice with `total < 0`.

### `backend/routers/billing.py`

Prefix: `/api/school-admin`, tag: `billing`

See [API_SPEC.md](API_SPEC.md#school-billing) for full endpoint shapes.

## Frontend

### `frontend/components/School/BillingModals.tsx`

| Export | Purpose |
|--------|---------|
| `BillingPlan` | TypeScript interface for plan data |
| `InvoiceDetail` | TypeScript interface for invoice detail |
| `PlanComparisonModal` | 3-column plan card grid with limit warnings |
| `UpgradeModal` | monthly/annual toggle, proration preview, confirmation checkbox |
| `InvoiceDetailModal` | invoice with line items table + `window.print()` button |

PDF download is implemented via `window.print()` on the `InvoiceDetailModal` — no
server-side PDF generation or extra dependencies needed.

### `frontend/pages/school/billing/plan.tsx`

- Fetches `GET /billing/overview` and `GET /billing/plan-comparison` in parallel
- `UsageBar` sub-component: green below 75%, amber 75–90%, red above 90%
- Forecast warnings rendered with `AlertTriangle` icon
- Opens `PlanComparisonModal` → `UpgradeModal` → calls `POST /billing/upgrade`

### `frontend/pages/school/billing/invoices.tsx`

- Paginated table (20 per page)
- Download button → fetches invoice detail → opens `InvoiceDetailModal` (print-capable)
- Email button → calls `POST /invoices/{id}/email`

## Tests

`backend/tests/test_billing.py` — 27 mock-based unit tests, no DB required.

Test classes:
- `TestPlanCatalogue` (6) — catalogue structure validation
- `TestSeedPlans` (3) — idempotency
- `TestGetPlans` (2) — list + format
- `TestComputeUsage` (2) — metrics structure, pct cap
- `TestComputeForecast` (2) — no warning when low, warning when near limit
- `TestUpgradePlan` (3) — success, unknown plan 404, positive proration
- `TestListInvoices` (2) — pagination structure
- `TestEmailInvoice` (3) — marks sent, no-email 400, override email
- `TestRequestModels` (4) — Pydantic validation

Run with:
```bash
cd backend
pytest tests/test_billing.py -v
```

## Deferred / Out of Scope

- Real Stripe/Flutterwave payment integration
- Server-side PDF generation (reportlab)
- Auto-email on invoice creation
- Dunning / payment failure handling
- Tax calculation beyond 0% flat rate
- Multi-currency support
