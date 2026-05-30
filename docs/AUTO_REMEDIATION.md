# Auto-Remediation

## Overview

When a built path scores below **60** on the legacy 0–100 EQS — the same threshold the existing pipeline already uses for "low quality" — the user can opt into a **three-tier remediation pass** that tries to surface better content.

This is an **opt-in, explicit flow**: the search endpoint does not auto-trigger remediation. The frontend surfaces a "Find better content" button next to the path stats; clicking it calls `POST /api/remediation/auto-remediate`, which runs the three tiers in order. Remediation cost is visible to the user (request is gated by the `remediation` daily budget in `cost_tracker`).

---

## Tiered Fallback

### Tier 1 — Claude variant search (~30s typical)
1. Ask Claude Opus 4.7 for **3 alternate query phrasings** of the user's topic.
2. Run each variant through the existing `SearchService.search_and_build_path` with `use_cache=False`.
3. Pick the variant whose path has the highest `average_score`.
4. If its score beats the original, success.

### Tier 2 — Gemini variant search (~60s typical)
Same shape as Tier 1, but Gemini 1.5 Pro generates the variants. Skips gracefully when:
- `GOOGLE_GEMINI_API_KEY` is not set, or
- `google-generativeai` SDK is missing (lazy-imported — CI without the SDK still loads).

### Tier 3 — Original path is our best
Return the original path unchanged with a "no better content available" notification. No additional LLM calls. The user is told honestly that we couldn't improve on what they already have.

> **What's NOT in scope:** a full Gemini scoring rail (EQS/summary/concept-graph via Gemini). Tier 2 uses Gemini purely for query expansion. A future packet could add diverse scoring rails if needed.

---

## Score thresholding

| Setting | Value | Lives in |
|---|---|---|
| Remediation threshold | `score < 60` | `LOW_CONFIDENCE_THRESHOLD` in `remediation_service.py` and `LOW_CONFIDENCE_THRESHOLD` in `SearchTopicForm.tsx` |
| Variants per tier | 3 | `VARIANT_COUNT` |
| Per-variant search timeout | 30s | `MAX_VARIANT_TIMEOUT_SEC` |

The threshold is set against the **legacy 0–100 EQS** (consistent with the existing `path_service` filter and the Packet 3.2 blacklist auto-trigger). The Packet 3.3 expanded scoring is a parallel rail that doesn't yet feed the search pipeline, so we don't reference it here.

---

## Cost Control

| Feature key | Daily budget | Per-call charge | Notes |
|---|---:|---:|---|
| `remediation` | ₦0.50 | ₦0.30 (Tier 1) or ₦0.45 (Tier 2) | ~1–2 full runs/day under cap |

Tier 1 charges `0.10 × 3 variants` before generating Claude variants. Tier 2 charges `0.15 × 3 variants` before generating Gemini variants. The variant searches that follow are NOT separately budgeted here — they piggyback on the existing search pipeline costs.

When the budget is exhausted mid-tier, that tier raises `BudgetExceeded` and falls through to the next. If all tiers skip via budget, the response is Tier 3 with a notification stating budget exhaustion in the notes.

---

## API

### POST `/api/remediation/auto-remediate`
Triggers the three-tier remediation. Requires authentication.

**Body:**
```json
{
  "query": "addition for kids",
  "original_score": 45.0,
  "original_path": { "videos": [...], "average_score": 45 }
}
```

`original_path` is opaque — the server doesn't read it, but returns it unchanged in Tier 3 fallback so the client doesn't lose state.

**Response (200):**
```json
{
  "success": true,
  "tier_used": "tier_1",
  "original_score": 45,
  "remediated_score": 82,
  "variant_query": "single-digit addition tutorial",
  "notification": {
    "state": "success",
    "message": "Found better videos via alternate Claude query. Score lifted from 45 to 82."
  },
  "duration_seconds": 28.4,
  "path": { "topic_id": "...", "videos": [...], "average_score": 82 }
}
```

**Errors:**
- `400` — `original_score` is not below the threshold (60). The frontend should not call this endpoint when score ≥ 60.
- `401` — Not authenticated.
- `500` — Unrecoverable error (logged with traceback).

### GET `/api/remediation/stats`
Admin: aggregate remediation statistics.

```json
{
  "total": 84,
  "success_rate": 0.69,
  "avg_duration_seconds": 42.1,
  "by_tier": {
    "tier_1": {"count": 60, "successes": 50, "success_rate": 0.833},
    "tier_2": {"count": 18, "successes": 8,  "success_rate": 0.444},
    "tier_3": {"count": 6,  "successes": 0,  "success_rate": 0.0}
  },
  "top_remediated_queries": [
    {"query": "addition", "count": 14},
    {"query": "photosynthesis", "count": 9}
  ]
}
```

---

## Database

### `remediation_events`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `query_normalized` | text, idx | Lowercased + trimmed query |
| `user_id` | UUID, nullable, idx | No enforced FK (anonymous fallback allowed) |
| `original_score` | int | |
| `remediated_score` | int | Equal to original on Tier 3 |
| `tier_used` | text, idx | `tier_1` / `tier_2` / `tier_3` |
| `success` | bool, idx | True only if a real improvement was found |
| `duration_ms` | int | End-to-end wall time |
| `notes` | text, nullable | Failure reasons or skipped-tier notes |
| `created_at` | timestamp | |

A row is written on **every** attempt (success or failure) so success-rate stats reflect reality.

---

## Frontend

[`RemediationNotification.tsx`](../frontend/components/RemediationNotification.tsx) is a modal with three phases:

- **loading** — animated spinner + "Trying alternate queries via Claude, then Gemini" copy
- **result** — original vs remediated score cards, the winning variant query (if any), a 5-video preview of the new path, and "Keep original" / "Use new path" buttons
- **error** — shows the server error and a close button

The button to open the modal lives in [`SearchTopicForm.tsx`](../frontend/components/Search/SearchTopicForm.tsx) and surfaces only when `result.stats.average_quality_score < 60`. Accepting the remediated path replaces the in-memory `BuiltPath` with the new one in place — no page reload, no re-fetch.

---

## Open follow-ups

- **Auto-trigger inside SearchService** (we chose not to do this — search stays fast and remediation cost stays user-visible). If we ever want it, gate behind a user-preference flag.
- **Surface remediation in the learning page** so users who didn't notice the low score on the search page get a second chance. Currently only on `/explore` via `SearchTopicForm`.
- **Per-tier budget envelopes** (currently a single `remediation` envelope). Useful if Gemini usage starts dwarfing Claude.
- **Wire user feedback on the remediated path** — was the new path actually better? Could feed `BlacklistFeedback`-style data into the stats dashboard.
