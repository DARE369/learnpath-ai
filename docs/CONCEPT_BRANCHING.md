# Concept Branching

## Overview

Every concept on LearnPath AI is split into **3–5 progressive learning branches**. A branch is a narrower, more specialised version of the parent concept; branches are ordered by difficulty and each one builds on the previous.

The classic example:

```
Concept: Addition
├─ Branch 1: Single-digit addition          (difficulty 1)
├─ Branch 2: Two-digit addition             (difficulty 2)
├─ Branch 3: Adding decimals                (difficulty 3)
├─ Branch 4: Word problems with addition    (difficulty 4)
└─ Branch 5: Multi-step addition problems   (difficulty 5)
```

Branches give learners an explicit on-ramp instead of forcing them to wade through a generic playlist that may be too easy or too advanced.

---

## How It Works

1. User opens a course detail page (`/courses/[courseId]`).
2. The frontend calls `GET /api/branching/{concept_name}`.
3. Backend checks the `concept_branches` table for a fresh cached set (≤ 30 days old, `is_active=true`).
4. **Cache hit:** rows are returned immediately, source `"cache"`.
5. **Cache miss:** the backend asks Claude Opus 4.7 to generate 3–5 branches with strictly-increasing difficulty and linear prerequisites, validates the response, persists the new set, and returns it with source `"generated"`.
6. The `BranchSelector` component renders one card per branch. Clicking **Learn this branch** redirects to the search pipeline with the branch title as the query.

---

## Validation Rules

A generated set must satisfy all of:

- `3 ≤ len(branches) ≤ 5`
- `difficulty_level` is **strictly** increasing across `branch_order` 0..N-1 (no ties — catches Claude returning "all level 3" responses)
- Every `branch_title` is non-empty
- Every `prerequisites` entry references an **earlier** branch title in the same set

If validation fails, the service raises `InvalidBranchSet` and the router returns `502 Bad Gateway`. The set is never persisted.

---

## Cost Control

Branch generation is fenced by a per-feature daily budget in [`services/cost_tracker.py`](../backend/services/cost_tracker.py).

| Feature      | Daily budget | Per-call charge | Calls/day |
| ------------ | ------------ | --------------- | --------- |
| `branching`  | ₦0.50        | ₦0.15           | ~3        |

When the budget is exhausted, `CostTracker.charge` raises `BudgetExceeded` and the router returns `429 Too Many Requests` with a human-readable message. Counters reset at UTC midnight; they also reset on backend redeploy, which is acceptable for a soft fence.

---

## API

### `GET /api/branching/{concept_name}`

Returns cached branches or generates them on miss.

**Query params:**
- `base_concept_summary` (optional): extra context for Claude on first generation.

**Response (200):**
```json
{
  "concept_name": "Addition",
  "branches": [
    {
      "branch_id": "uuid",
      "concept_name": "Addition",
      "branch_title": "Single-digit addition",
      "description": "Adding two numbers where each is under 10.",
      "difficulty_level": 1,
      "prerequisites": [],
      "estimated_duration_minutes": 15,
      "branch_order": 0
    }
  ],
  "source": "cache",
  "cost_remaining_ngn": 0.35
}
```

**Errors:**
- `400` — empty concept_name
- `429` — daily budget exhausted (`Daily budget for 'branching' exceeded`)
- `502` — Claude returned a set that failed validation

### `POST /api/branching/{concept_name}/regenerate`

Admin: force-regenerate, bypassing the cache. Same response shape; same error semantics. Charges the budget like a normal generation.

**Body:**
```json
{
  "base_concept_summary": "...",
  "force_regenerate": true
}
```

### `POST /api/branching/{concept_name}/branches/{branch_id}/learning-path`

Stub for Packet 3.1 — returns `{branch_id, branch_title, status: "not_yet_implemented"}`. Real branch-scoped path assembly arrives in a follow-up packet once we decide how branch context shapes the YouTube search query.

For now, the frontend handles branch selection by routing to `/explore?q=<branch_title>&autorun=1`, which feeds the title through the existing search pipeline.

### `POST /api/branching/validate`

Admin: validate a candidate branch set without persisting. Returns `{is_valid: bool, issues: [str]}`.

### `GET /api/branching/admin/cost-stats`

Returns today's spend per feature (branching, remediation, expansion).

---

## Database

### Table: `concept_branches`

| Column                       | Type      | Notes                                              |
| ---------------------------- | --------- | -------------------------------------------------- |
| `id`                         | UUID PK   |                                                    |
| `concept_key`                | text, idx | Lowercased concept name — the cache lookup key     |
| `concept_name`               | text      | Display form of the concept                        |
| `branch_title`               | text      | "Two-digit addition"                               |
| `description`                | text      | One sentence                                       |
| `difficulty_level`           | int       | 1–5, strictly monotonic across `branch_order`      |
| `prerequisites`              | json      | List of earlier branch titles                      |
| `estimated_duration_minutes` | int       |                                                    |
| `branch_order`               | int, idx  | Position in the set, 0-indexed                     |
| `algorithm_version`          | text      | `v1`                                               |
| `is_active`                  | bool, idx | `false` for superseded sets (regenerate keeps audit) |
| `created_at` / `updated_at`  | timestamp |                                                    |

No FK to `topics.id` — branches are keyed by concept name, mirroring the [path_sessions](../backend/models.py) pattern where search-built concepts live outside the topics table.

---

## Caching

- TTL: **30 days** (filtered by `created_at >= now - 30 days`).
- Regeneration **soft-deletes** prior sets via `is_active=false` rather than `DELETE`, preserving an audit trail.
- The cache is DB-backed (not in-memory) so it survives backend restarts. Branch generation is expensive enough that losing the cache on every redeploy would be wasteful.

---

## Frontend

[`BranchSelector.tsx`](../frontend/components/Learning/BranchSelector.tsx) renders a responsive grid of branch cards. Each card shows:

- Branch number and difficulty dots (1–5)
- Branch title and description
- Difficulty label ("Foundational" → "Expert") and estimated duration
- Prerequisites (if any)
- **Learn this branch** button → `onSelect(branch)`

The component is integrated into [`courses/[courseId].tsx`](../frontend/pages/courses/[courseId].tsx) above the Syllabus block. Clicking a branch routes to `/explore?q=<branch_title>&autorun=1`.

---

## Configuration

- Model: `claude-opus-4-7` (matches [`concept_graph_service.py`](../backend/services/concept_graph_service.py))
- Max tokens: 2000
- Algorithm version: `v1` (bump when prompt or validation rules change)
