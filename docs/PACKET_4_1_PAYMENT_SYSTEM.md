# Packet 4.1 — Payment System & Subscription Models

**Status:** Shipped
**Stage:** 4 (Monetization layer)

Complete payment + subscription system for LearnPath AI, using **Flutterwave**
for checkout and **NGN** pricing. Adds three plans (Free / Pro / Premium), usage
limits derived from existing activity, pro-rated upgrades, queued downgrades,
auto-renewal, and a full audit trail.

## What was built

### Backend

| File | Role |
|------|------|
| `services/subscription_service.py` | Plan catalogue, lifecycle, usage, renewal, billing — see [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md) |
| `services/payment_service.py` | Flutterwave REST v3 wrapper (init / verify / refund / webhook) |
| `routers/subscriptions.py` | `/api/subscriptions/*` and `/api/payments/*` endpoints |
| `models.py` | `Subscription`, `Transaction`, `BillingHistory` tables |
| `config.py` | Flutterwave + payment settings (all optional) |
| `main.py` | Router registration + idempotent schema patches |

### Frontend

| File | Role |
|------|------|
| `pages/billing.tsx` | Current plan, usage meters, plan comparison, billing history, cancel |
| `pages/payment.tsx` | Plan summary, payment-method selection, redirect to Flutterwave |
| `components/Navbar.tsx` | "Billing" entry in the profile dropdown |
| `pages/_app.tsx` | `/billing` + `/payment` added to protected route prefixes |

### Tests

- `tests/unit/test_subscription_service.py` — unit tests covering the plan
  catalogue, pricing, proration, renewal-date math, usage percentages, and
  PaymentService's safe-by-default behaviour + webhook parsing. No DB/network.

## Plans

See [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md#subscription-plans) for the
full limits table. Summary: Free NGN 0, Pro NGN 2,999/mo, Premium NGN 9,999/mo;
yearly billing gives 2 months free.

## Payment flow

1. User picks a paid plan on `/billing` -> routed to `/payment?plan=...&cycle=...`.
2. `/payment` calls `POST /api/payments/initialize`, which records a **pending**
   `Transaction` and asks Flutterwave for a checkout link.
3. Browser is redirected to the Flutterwave hosted page.
4. On return, Flutterwave appends `?status=...&tx_ref=...`; `/billing` calls
   `GET /api/payments/verify/{tx_ref}` to reconcile.
5. In parallel, Flutterwave hits `POST /api/payments/webhook`
   (verified via the `verif-hash` header) as the source-of-truth confirmation.
6. Confirmation is **idempotent** — `confirm_payment()` provisions the plan once
   and writes a `BillingHistory` line; repeat calls are no-ops.

## Database

Three tables (see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)):
`subscriptions`, `transactions`, `billing_history`. Created via `create_all`;
indexes/late columns applied by the idempotent `_SCHEMA_PATCHES` in `main.py`.

## Safety / conventions

- **No live calls without keys.** PaymentService raises `PaymentError` when
  `FLUTTERWAVE_SECRET_KEY` is unset, so dev and CI never touch the network.
- **One active subscription per user**, enforced in the service layer.
- **users.tier stays authoritative** — every plan change syncs it.
- **Icons via `lucide-react`** on the new pages, no emojis. Dark theme `#0f0f0f` +
  indigo `#6366f1` accent, matching the rest of the app (not the placeholder blue
  in the original packet brief).

## Environment variables

```
FLUTTERWAVE_PUBLIC_KEY=...
FLUTTERWAVE_SECRET_KEY=...
FLUTTERWAVE_WEBHOOK_SECRET=...
FLUTTERWAVE_BASE_URL=https://api.flutterwave.com/v3
PAYMENT_SUCCESS_URL=https://<frontend>/billing?status=success
PAYMENT_CANCEL_URL=https://<frontend>/billing?status=cancelled
PAYMENT_CURRENCY=NGN
```

## API endpoints

```
GET  /api/subscriptions/plans         # public pricing catalogue
GET  /api/subscriptions/current       # current plan + live usage
POST /api/subscriptions/create        # free plan only
POST /api/subscriptions/upgrade       # -> payment link (pro-rated)
POST /api/subscriptions/downgrade     # queued for next renewal
POST /api/subscriptions/cancel        # cancel auto-renew
GET  /api/subscriptions/history       # billing history
POST /api/payments/initialize         # start a paid checkout
GET  /api/payments/verify/{reference} # reconcile a payment
POST /api/payments/webhook            # Flutterwave webhook (signature-verified)
```
