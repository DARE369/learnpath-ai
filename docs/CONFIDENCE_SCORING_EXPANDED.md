# Expanded Confidence Scoring (11 Criteria, 0–170 Points)

## Overview

The expanded EQS scores videos on **11 weighted criteria** instead of the legacy 14-question binary rubric. The new scale runs from 0 to a theoretical max of 170 points (100 base + 70 bonus). Scores map to five confidence levels and a score-dependent cache TTL.

This service **coexists** with the legacy [eqs_service.py](../backend/services/eqs_service.py) — the search pipeline and blacklist auto-trigger still use the 0-100 service. The expanded service is a parallel rail consumed by the admin confidence dashboard. Migrating the search pipeline to expanded scoring is a deferred follow-up.

> **Spec note:** the original Packet 3.3 spec headlines "max 150" but lists per-criterion weights that sum to 170. We trust the explicit weights (15+12+8+10+10+8+7 = 70 bonus) and let the theoretical max float to 170; the confidence ladder still terminates at "outstanding (131+)".

---

## Scoring Breakdown

### Base criteria — 100 pts total

| Criterion | Max | Looks for |
|---|---:|---|
| `pedagogy` | 40 | Clear objectives, structured progression, examples, summary |
| `clarity` | 30 | Clear narration, good visuals, appropriate pacing, visual aids |
| `credibility` | 20 | Creator credentials, accuracy, current information |
| `length` | 10 | 4–10 minute sweet spot, appropriate for topic |

### Bonus criteria — 70 pts total

| Criterion | Max | Looks for |
|---|---:|---|
| `engagement` | 15 | Animations, interactions, prompts |
| `production` | 12 | Resolution, audio quality |
| `recency` | 8 | Recently updated |
| `accessibility` | 10 | Captions, descriptions |
| `student_feedback` | 10 | High ratings, positive reviews |
| `curriculum_align` | 8 | Matches educational standards |
| `diversity` | 7 | Inclusive, representative content |

---

## Confidence Levels & Cache TTL

| Total score | Level | Cache TTL | Use |
|---:|---|---:|---|
| 0–50 | poor | none (re-eval immediately) | Avoid; consider blacklist |
| 51–70 | acceptable | 7 days | Low priority |
| 71–100 | good | 14 days | Standard rotation |
| 101–130 | excellent | 30 days | Recommend |
| 131–170 | outstanding | 60 days | Featured |

The exact TTL ladder (implemented in `compute_cache_ttl`):

```
total >= 120  → 60 days
total >= 100  → 30 days
total >=  80  → 14 days
total >=  60  →  7 days
otherwise     →  0 (re-evaluate immediately)
```

At write time the service persists `evaluated_at = now` and `next_reevaluation_at = now + cache_ttl_days`. A future search reading the row checks `next_reevaluation_at < now` to decide whether to re-score.

---

## Validation & Robustness

Claude's JSON response is parsed and validated:

- Each base sub-score is **clamped** to its declared max (40/30/20/10) — over-shooting Claude doesn't get a free lunch
- Each bonus sub-score is clamped to its declared max (15/12/8/10/10/8/7)
- Negative values are floored at 0
- Missing keys default to 0
- Non-integer values raise `InvalidScoreResponse` → router returns `502`
- `total_score` is **computed server-side** from sub-scores; Claude's claimed total is ignored
- `confidence_level` is **derived server-side** from `total_score`; Claude's claimed level is ignored

---

## API

### POST `/api/eqs/expanded/score`
Score a video.

**Body:**
```json
{
  "youtube_id": "abc123",
  "video_summary": "This video covers photosynthesis from first principles...",
  "title": "Photosynthesis 101",
  "transcript_excerpt": "optional, first 2000 chars used"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "youtube_id": "abc123",
  "base_scores": {"pedagogy": 35, "clarity": 28, "credibility": 18, "length": 9},
  "bonus_scores": {"engagement": 12, "production": 10, ...},
  "base_score": 90,
  "bonus_total": 57,
  "total_score": 147,
  "confidence_level": "outstanding",
  "cache_ttl_days": 60,
  "reasoning": "Strong pedagogical structure...",
  "cost_remaining_ngn": 0.30
}
```

**Errors:**
- `400` — empty youtube_id or summary too short (<10 chars)
- `429` — daily `eqs_expanded` budget (₦0.50) exhausted
- `502` — Claude returned malformed JSON

### GET `/api/eqs/expanded/list`
List active scored videos.

**Query params:**
- `confidence_level` — filter by `poor|acceptable|good|excellent|outstanding`
- `limit`, `offset` — pagination

### GET `/api/eqs/expanded/stats`
Aggregates for the dashboard:

```json
{
  "total_scored": 24,
  "average_score": 98.5,
  "median_score": 102,
  "distribution": {"outstanding": 3, "excellent": 7, "good": 9, "acceptable": 4, "poor": 1},
  "criteria_averages": {"pedagogy": 28.3, "clarity": 22.1, ...},
  "cache_distribution": {"0d": 1, "7d": 4, "14d": 9, "30d": 7, "60d": 3}
}
```

---

## Database

### `expanded_video_scores`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `youtube_id` | text, idx | Keyed on youtube_id, no FK (same MVP convention as 3.1/3.2) |
| `base_scores` | json | `{pedagogy, clarity, credibility, length}` |
| `bonus_scores` | json | All 7 bonus sub-scores |
| `base_score` | int | Sum of base (denormalized for filtering) |
| `total_score` | int, idx | base + bonus |
| `confidence_level` | text, idx | `poor|acceptable|good|excellent|outstanding` |
| `cache_ttl_days` | int | 0/7/14/30/60 |
| `reasoning` | text | Claude's 2–3 sentence justification |
| `algorithm_version` | text | `expanded_v1` |
| `is_valid` | bool, idx | `false` for superseded rows |
| `evaluated_at` | timestamp | |
| `next_reevaluation_at` | timestamp, nullable | NULL when `cache_ttl_days = 0` |
| `created_at` / `updated_at` | timestamp | |

Re-scoring the same youtube_id **soft-deletes** prior active rows via `is_valid=false`, preserving an audit trail.

---

## Admin Dashboard

[`/admin/confidence`](../frontend/pages/admin/confidence.tsx) renders [`ConfidenceDashboard.tsx`](../frontend/components/Admin/ConfidenceDashboard.tsx):

- **Stat cards** — total scored, avg, median, count in top tier (excellent + outstanding)
- **Score histogram** — 5 confidence bands, clickable to filter the table
- **Criteria averages** — 11 horizontal bars (base + bonus) with percentages of max
- **Cache TTL distribution** — chips for 0d/7d/14d/30d/60d counts
- **Filter pills** — all/outstanding/excellent/good/acceptable/poor
- **Per-video table** with expand-on-click breakdown showing all 11 sub-scores plus reasoning

### Known gap

Same as Packet 3.2: the `/admin` route is login-required via `PROTECTED_PREFIXES` but not role-gated. Any logged-in user can hit the dashboard or the score endpoint. Admin-role gating is tracked as a Stage 4 concern.

---

## Cost Control

| Feature key | Daily budget | Per-call | Notes |
|---|---:|---:|---|
| `eqs_expanded` | ₦0.50 | ₦0.20 | ~2–3 scores/day under cap |

The `/list` and `/stats` reads are pure DB queries and don't draw on the budget. Only the POST `/score` endpoint charges.

---

## Migration to expanded scoring (deferred)

When we eventually wire expanded scoring into the search pipeline, the work is:

1. Rewrite `path_service`'s `score >= 65` threshold to use `confidence_level >= "good"` or equivalent on the new scale
2. Rewrite the blacklist auto-trigger in `search_service` (currently `EQS < 65`) to use the expanded level
3. Backfill `expanded_video_scores` for videos with active legacy `VideoScore` rows (use the bulk batch path with a relaxed budget)
4. Decide whether the legacy `EQSService` retires or stays for a transition window

None of that is in scope for Packet 3.3.
