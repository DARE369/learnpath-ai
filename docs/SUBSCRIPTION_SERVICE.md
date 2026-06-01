# SubscriptionService — Payment & Subscription Management

Part of **Packet 4.1 — Payment System & Subscription Models**.

## Purpose

Owns the plan catalogue, usage limits, and the full lifecycle of a user's
subscription: create, upgrade, downgrade, cancel, daily renewal, payment
reconciliation, and billing history. Money movement is delegated to
[`PaymentService`](#paymentservice-flutterwave); this service records the
`Subscription` / `Transaction` / `BillingHistory` rows and keeps `users.tier`
in sync so the rest of the app can gate features off the `User` row alone.

## Subscription Plans

| Plan    | Price (NGN/mo) | Videos/mo | Hours/mo | Questions/day | Concepts/topic | Features |
|---------|----------------|-----------|----------|---------------|----------------|----------|
| Free    | NGN 0          | 10        | 10       | 5             | 5              | — |
| Pro     | NGN 2,999      | 100       | 100      | 20            | Unlimited      | offline_access, ad_free |
| Premium | NGN 9,999      | Unlimited | Unlimited| Unlimited     | Unlimited      | offline_access, ad_free, priority_support |

- "Unlimited" is the sentinel `999999`.
- **Yearly billing** charges 10 months for 12 (2 months free): `yearly_price = monthly * 10`.

## Lifecycle

- **Create** — `create_subscription()` deactivates any prior active row (sets it
  `expired`) so a user only ever has one `active` subscription, then syncs
  `users.tier`.
- **Upgrade** — immediate. The router computes a **pro-rated charge**
  (`upgrade_charge`) and routes the user through payment; on confirmation the
  new plan replaces the active one.
- **Downgrade** — queued. `downgrade_plan()` sets `pending_plan_type`; the user
  keeps the higher plan until `renewal_date`, when the daily renewal job applies
  the pending plan.
- **Cancel** — `cancel_subscription()` turns off `auto_renew` and marks the row
  `cancelled`; access continues until `renewal_date`, then renewal expires it and
  drops the user to Free.
- **Renewal** — `handle_subscription_renewal()` is the daily job: expires
  cancelled/non-renewing subs, applies pending downgrades, extends renewing subs,
  and writes a `BillingHistory` line each time.

## Pure helpers (unit-tested, no DB/network)

| Method | Description |
|--------|-------------|
| `get_plan(plan_type)` | Plan dict or `PlanNotFoundError` |
| `plan_price(plan_type, cycle)` | Period price in NGN |
| `compute_renewal_date(start, cycle)` | +30d monthly / +365d yearly |
| `is_upgrade / is_downgrade(a, b)` | Rank comparison (free<pro<premium) |
| `prorated_credit(plan, cycle, days_remaining)` | Unused value of current period |
| `upgrade_charge(cur, new, cycle, days_remaining)` | New price minus credit, floored at 0 |
| `usage_percentage(used, limit)` | 0–100, 0 for unlimited |

## Usage tracking

`get_user_plan()` returns live usage derived from existing tables — no separate
counters to keep in sync:

- **Videos this month** — `path_sessions` where `video_watched` since the 1st.
- **Hours this month** — `sum(total_watch_time_seconds) / 3600` since the 1st.
- **Questions today** — `question_answers` created since 00:00 UTC.

All usage queries are best-effort (degrade to `0` on error) so the billing page
never 500s.

## Usage example

```python
from services.subscription_service import subscription_service

# Free plan (no payment)
subscription_service.create_subscription(db, user_id, "free")

# Current plan + usage
plan = subscription_service.get_user_plan(db, user_id)

# Downgrade (queued for next renewal)
subscription_service.downgrade_plan(db, user_id, "pro")

# Start a paid upgrade (returns a Flutterwave payment link)
await subscription_service.process_payment(
    db, user_id=user_id, amount=2999, plan_type="pro", email=user.email,
)

# Reconcile after Flutterwave confirms (idempotent)
subscription_service.confirm_payment(db, reference)
```

## Errors

| Exception | Meaning |
|-----------|---------|
| `PlanNotFoundError` | Unknown `plan_type` |
| `SubscriptionNotFoundError` | No active subscription |
| `ActiveSubscriptionError` | User already has an active paid subscription |
| `InvalidPlanChangeError` | Upgrade/downgrade target invalid from current plan |

---

## PaymentService (Flutterwave)

Thin async wrapper over Flutterwave REST API v3 (`httpx.AsyncClient`).

| Method | Description |
|--------|-------------|
| `initialize_payment(...)` | Create a hosted checkout; returns `payment_link` |
| `verify_payment(reference)` | Verify by our `tx_ref`; normalises status |
| `refund_payment(flutterwave_id, amount?)` | Refund a transaction |
| `verify_webhook_signature(sig, body)` | Validate the `verif-hash` header |
| `parse_webhook_event(event)` | Normalise webhook to `{reference, status, flutterwave_id}` |

**Safe by default:** when `FLUTTERWAVE_SECRET_KEY` is unset (dev/CI), every
network method raises `PaymentError` instead of calling out — tests never hit the
wire. Webhook verification rejects everything when no `FLUTTERWAVE_WEBHOOK_SECRET`
is configured.

### Environment variables

```
FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_SECRET_KEY
FLUTTERWAVE_WEBHOOK_SECRET
FLUTTERWAVE_BASE_URL        # default https://api.flutterwave.com/v3
PAYMENT_SUCCESS_URL
PAYMENT_CANCEL_URL
PAYMENT_CURRENCY            # default NGN
```

## API surface

All routes require auth except `GET /api/subscriptions/plans` (public pricing)
and `POST /api/payments/webhook` (verified by signature). See
[API_SPEC.md](API_SPEC.md) -> "Payments & Subscriptions — Packet 4.1".
