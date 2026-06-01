# Packet 4.4 — Feature Unlock System

**Status:** Shipped
**Stage:** 4 (Monetization layer)
**Depends on:** Packets 4.1–4.3

Freemium feature-gating layer. Single source of truth for which features are
available per plan. Exposes richer plan-level summaries, per-feature promo
payloads, and two frontend components for in-context feature locking.

## What was built

### Backend

| File | Role |
|------|------|
| `services/feature_unlock_service.py` | Wraps `free_tier_service.FEATURE_MAP`; adds `FEATURE_INFO` (benefit lists per feature), `get_features_for_plan` (available + locked + limits), `show_feature_promo` (promo payload), `log_feature_usage` (logger, no DB table at MVP) |
| `routers/features.py` | `/api/features/*` endpoints — richer than `/api/free-tier/features` |
| `main.py` | Registers `/api/features` router |

### Frontend

| File | Role |
|------|------|
| `components/Features/FeatureLock.tsx` | In-context locked-feature card with benefits list, plan comparison, and upgrade CTA — returns null when user already has access |
| `components/Billing/FeatureMatrix.tsx` | Full feature comparison table (Free / Pro / Premium); mobile horizontally-scrollable; highlights a "recommended" plan column; embedded on the billing page |
| `pages/billing.tsx` | `FeatureMatrix` added between plan cards and billing history |

### Tests

- `tests/unit/test_feature_unlock.py` — 21 tests: per-plan availability, plan summaries, promo payloads, catalogue integrity, price ordering. No DB or network.

## Feature matrix

See `services/feature_unlock_service.FEATURE_INFO` for full details.

| Feature | Free | Pro | Premium |
|---------|------|-----|---------|
| Browse / watch / progress | Yes | Yes | Yes |
| Concept branching | Yes | Yes | Yes |
| AI search & path building | Capped | Capped | Unlimited |
| Active recall questions | Capped | Capped | Unlimited |
| Offline download | No | Yes | Yes |
| Advanced questions | No | Yes | Yes |
| Ad-free | No | Yes | Yes |
| Custom paths | No | No | Yes |
| Certificate generation | No | No | Yes |
| Priority support | No | No | Yes |
| API access | No | No | Yes |

## API endpoints

```
GET  /api/features/check/{feature_name}  # per-user feature check (enriched)
GET  /api/features/available             # available + locked split for current user
GET  /api/features/plan/{plan_type}      # public plan feature matrix (no auth)
GET  /api/features/info/{feature_name}   # feature promo payload
GET  /api/features/all                   # full FEATURE_INFO catalogue
POST /api/features/{feature_name}/log    # log view/use event (best-effort)
```

## Design decisions vs. packet brief

| Packet spec | What was built | Reason |
|-------------|----------------|--------|
| `Feature`, `FeatureUsageLog`, `FeaturePromoDisplay` DB tables | No new tables | Feature map is static config; analytics logging goes to the app logger for now (no user-facing benefit from DB at MVP) |
| `async def is_feature_available(user_id)` (DB read) | `check_feature(plan_type, feature_name)` (pure) | Router already has `current_user.tier` from the auth dep — no extra DB round-trip needed |
| Caching layer | Not needed | Service is pure Python; sub-microsecond per call |
