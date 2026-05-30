# Blacklist System & Video Quality Control

## Overview

LearnPath AI suppresses low-quality YouTube videos from learner-facing paths through two mechanisms:

- **Soft blacklist** — auto-triggered for any video whose EQS scores below 65. Hidden for 90 days, then re-evaluated.
- **Hard blacklist** — set manually by an admin for content that should never surface (inappropriate, copyright, factually wrong, etc.). Never re-evaluated.

A deterministic **1-in-10 slice of logged-in users** (shadow testers) still sees soft-blacklisted videos so the system can collect feedback on whether the score was correct.

---

## How It Works

### 1. During search (the main loop)

The search pipeline ([backend/services/search_service.py](../backend/services/search_service.py)) gained two blacklist steps:

```
Step 3:    YouTube search (20 candidates)
Step 3.5:  Filter out blacklisted youtube_ids ← NEW (skips for shadow testers)
Step 4:    Transcript fetch + EQS scoring
Step 4.5:  Auto-soft-blacklist new scores < 65 ← NEW
Step 5-7:  Summary, concept graph, path assembly
```

The pre-filter is the load-bearing performance win: every blacklisted video we skip saves a Claude EQS call on the next search that surfaces it.

### 2. Re-evaluation (admin-triggered)

`POST /api/blacklist/re-evaluate` scans active soft blacklists whose `retry_date` has passed, re-scores them via EQS, and either:

- **Lifts** the blacklist if the new score ≥ 65, or
- **Extends** the soft blacklist by another 90 days if still < 65.

Each re-score costs a Claude call, so the batch is **budget-gated** through `cost_tracker.charge("blacklist_reeval", ₦0.10/row)` — ~5 re-scores/day under the ₦0.50 cap. The endpoint returns counts plus how many rows it had to skip when the budget ran out.

This is intentionally not a scheduled job in Packet 3.2; the nightly job harness arrives with Packet 3.5.

### 3. Shadow testing

`BlacklistService.should_shadow_test(user_id)` returns True for ~10% of logged-in users, deterministically:

```python
bucket = int(sha256(user_id)[:8], 16) % 10
return bucket == 0
```

For those users, the search pre-filter is skipped — they see soft-blacklisted videos and can submit feedback via `POST /api/blacklist/feedback`. Anonymous (non-logged-in) users always return False. Hard blacklists are never shadow-tested.

> **UI note:** the feedback endpoint is wired backend-only in Packet 3.2. Surfacing a "rate this video" prompt in `VideoPlayer` for shadow-tested videos is a follow-up.

### 4. Auto-blacklist batch backfill

`POST /api/blacklist/auto-blacklist-low-scores` scans the `video_scores` table for any youtube_id whose minimum recorded EQS is below the threshold and creates a soft-blacklist row if one doesn't exist. Useful for one-shot backfills after model changes; the per-search trigger above handles ongoing flow.

---

## Database

### `video_blacklist`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `youtube_id` | text, idx | **Keyed on youtube_id**, not videos.id — same pattern as `path_sessions.youtube_id` (search-built flow doesn't always create a videos row). |
| `blacklist_type` | text | `"soft"` or `"hard"` |
| `reason` | text | Human-readable; `"Auto-blacklist: EQS NN < 65"` for auto. |
| `last_score` | int, nullable | EQS that triggered. `NULL` for manual entries. |
| `blacklist_date` | timestamp | |
| `retry_date` | timestamp, nullable | `NULL` for hard; +90 days from `blacklist_date` for soft. |
| `is_active` | bool, idx | `false` when lifted (kept for audit). |
| `created_at` / `updated_at` | timestamp | |

### `blacklist_feedback`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `youtube_id` | text, idx | |
| `user_id` | UUID, nullable, idx | No enforced FK (anonymous shadow feedback allowed). |
| `rating` | int | 1–5 |
| `feedback` | text, nullable | |
| `helpful` | bool, nullable | |
| `created_at` | timestamp | |

---

## API

### `POST /api/blacklist`
Manually blacklist a video.

**Body:**
```json
{
  "youtube_id": "abc123",
  "reason": "Inaccurate content",
  "blacklist_type": "hard"
}
```

### `DELETE /api/blacklist/{youtube_id}`
Lift any active blacklist for a video. Returns 404 if none exists.

### `PATCH /api/blacklist/{youtube_id}`
Convert soft↔hard.

**Body:**
```json
{ "blacklist_type": "hard", "reason": "optional override" }
```

### `GET /api/blacklist/status/{youtube_id}`
Returns `{is_blacklisted, blacklist_type, reason, last_score, blacklist_date, retry_date, expired}`.

### `GET /api/blacklist?blacklist_type=soft&limit=100&offset=0`
List active blacklisted videos with per-row feedback aggregates.

### `POST /api/blacklist/auto-blacklist-low-scores?score_threshold=65`
Batch scan `video_scores` and create soft-blacklist rows.

### `POST /api/blacklist/re-evaluate?limit=100`
Re-score expired soft blacklists. Returns `{evaluated, lifted, extended, errors, skipped_budget, total_expired}`. Stops cleanly when `blacklist_reeval` budget is exhausted.

### `POST /api/blacklist/feedback`
**Body:** `{youtube_id, rating: 1-5, feedback?, helpful?, user_id?}`. `400` if rating out of range.

### `GET /api/blacklist/stats`
Aggregate counts: `total_active`, `soft`, `hard`, `pending_re_evaluation`, `feedback_count`, `feedback_avg_rating`.

### `GET /api/blacklist/shadow-test/{user_id}`
Diagnostic: returns whether a user_id falls in the shadow-test bucket.

---

## Admin Dashboard

[`/admin/blacklist`](../frontend/pages/admin/blacklist.tsx) renders [`BlacklistDashboard.tsx`](../frontend/components/Admin/BlacklistDashboard.tsx) with:

- Stats cards (total, soft, hard, pending re-eval, avg feedback rating)
- Filter by type (all / soft / hard)
- Client-side sort by date, score, or type
- Per-row actions: **Make permanent** (soft→hard), **Soften** (hard→soft), **Lift** (deactivate)
- Action buttons: **Re-evaluate expired** and **Auto-blacklist low scores** (calls the batch endpoints)

### Known gap: no admin role

The `/admin` route is protected by login (added to `_app.tsx` PROTECTED_PREFIXES) but **not by role** — there's no `is_admin` field on `User` yet. Any logged-in user can hit the page or the admin endpoints. Adding role-based gating is out of scope for Packet 3.2 and tracked as a Stage 4 concern.

---

## Cost Control

| Feature key | Daily budget | Per-call | Why |
| --- | --- | --- | --- |
| `blacklist_reeval` | ₦0.50 | ₦0.10/row | Re-evaluation re-scores via EQS — the only Claude-spending blacklist operation. |

The auto-blacklist trigger during search and the dashboard list endpoints are pure DB operations and don't draw on the budget.

When budget exhausts mid-batch, `re_evaluate_blacklist` returns early with `skipped_budget = N` so the caller knows what's left to process tomorrow.

---

## Testing

Unit tests live in [`backend/tests/unit/test_blacklist_service.py`](../backend/tests/unit/test_blacklist_service.py). They use an in-memory SQLite session restricted to `video_blacklist` and `blacklist_feedback` (the rest of the schema uses Postgres-only ARRAY columns).

Coverage includes:
- Soft/hard blacklist creation, retry_date semantics, idempotent re-blacklisting
- `is_blacklisted` lazy expiry on past `retry_date`
- `filter_blacklisted` excludes active and includes expired
- `convert_type` soft↔hard with retry_date adjustments
- Feedback rating range validation, aggregates
- `should_shadow_test` determinism + roughly-10% distribution over 1000 samples
- `re_evaluate_blacklist` lift (≥65), extend (<65), and skip non-expired — with mocked EQS
