# Self-Building Mechanism

## Overview

A nightly background job that improves the catalog without human input:

1. **Dedups** recent search queries that refer to the same underlying topic ("photosynthesis" ≡ "how plants make food") via Claude Opus semantic clustering.
2. **Indexes keywords** for popular topics (3–5 keywords per topic, future search-suggestions feed).
3. **Auto-expands** popular topics by delegating to [branching_service](../backend/services/branching_service.py) — the Packet 3.1 service that already generates 3–5 progressive learning branches per concept.

The job is **opt-in via env flag** (`EXPANSION_SCHEDULER_ENABLED=true`) and **always callable manually** via the admin endpoint — useful in staging or for backfills.

---

## How It Works

### Data input: SearchEvent

[backend/services/search_service.py](../backend/services/search_service.py) now writes a `SearchEvent` row on every successful `search_and_build_path` call (best-effort — never blocks search). Fields:

| Column | Notes |
|---|---|
| `query_normalized` | Lowercased + trimmed query |
| `user_id` | Nullable — anonymous searches still counted |
| `source` | `cache` / `generated` / `remediated` |
| `average_score` | Path's EQS at the time of search |
| `created_at` | Indexed for the 30-day window query |

This is the **only** signal the expansion service uses for popularity detection. There was no per-query counter before this packet.

### Step 1 — Dedup (semantic clustering)

```
collect distinct query_normalized in last 30 days
  → if ≥ 2 queries: charge ₦0.20 to `expansion` budget
  → ask Claude Opus to group queries that describe the SAME topic
  → for each group with aliases: write TopicAlias rows (alias_query → canonical_query)
```

The clustering call returns one JSON document per run — single Claude call regardless of how many queries there are. Confidence (0–1) from Claude is stored on each alias row.

> **Alias mappings are stored, not applied.** `SearchService` does **not** consult `TopicAlias` to redirect queries this packet — the admin dashboard surfaces proposed mappings so a human can validate accuracy on real data before any auto-redirect ships.

### Step 2 — Popular topic identification

A query is "popular" if it has **>10 searches in 30 days** (strict `>`, not `≥`). No LLM call, pure DB count.

### Step 3 — Keyword indexing

For each popular topic, one Claude call returns 3–5 short keywords. ₦0.03 per topic. If the `expansion` budget runs out mid-list, remaining topics are reported in `skipped_budget`. Replaces any prior keyword index for the topic.

### Step 4 — Auto-expansion (delegates to branching)

```
for each popular topic:
  branching_service.generate_branches(topic, "Auto-expansion: ...", db)
```

This calls into [Packet 3.1](CONCEPT_BRANCHING.md) — same 11-criterion validation, same 30-day DB cache, same `branching` budget envelope. Expansion budget pays for the dedup and keyword steps; branching budget pays for the branch calls. **No double-charging.**

### Step 5 — NightlyRun record

The orchestrator writes one `NightlyRun` row per execution with start/finish timestamps, per-step counts, costs charged, errors list, and a status:

- `success` — everything ran cleanly
- `partial` — budget capped or non-fatal errors
- `failed` — errors + no keywords or expansions produced
- `running` — only seen if the process died mid-run

The dashboard reads from this for the last-10-runs panel.

---

## Cost Ledger

| Step | Charges | Budget |
|---|---:|---|
| Dedup clustering | 1× ₦0.20/run | `expansion` |
| Keyword extraction | ₦0.03 × N topics | `expansion` |
| Branch generation | branching_service's per-call | `branching` |

Both budgets default to ₦0.50/day per `cost_tracker.DEFAULT_BUDGETS_NGN`. When any budget exhausts, the running step ends gracefully — the job always finishes and always logs.

---

## Scheduler

[backend/jobs/nightly_expansion.py](../backend/jobs/nightly_expansion.py) wires an `AsyncIOScheduler` in the FastAPI lifespan when `EXPANSION_SCHEDULER_ENABLED=True`:

```python
scheduler.add_job(
    run_nightly_expansion,
    trigger=CronTrigger(hour=settings.EXPANSION_SCHEDULER_HOUR_UTC, minute=0),
    coalesce=True,        # if the process restarts mid-window, run once not N times
    max_instances=1,
)
```

Default time is **02:00 UTC** (midnight WAT, the user's timezone). Configurable via `EXPANSION_SCHEDULER_HOUR_UTC`.

The scheduler is **not** started when the flag is off — dev and CI default to off so no accidental Claude/YT spending overnight. The admin `/run-now` endpoint works regardless of the flag.

### Single-instance assumption

The scheduler runs in-process. If we ever scale Railway beyond one worker, multiple instances would fire the job nightly. Out of scope for this packet — a Redis-based lock or external cron (Railway's scheduled jobs) would be the migration path. Documented as future work.

---

## API

### POST `/api/expansion/run-now`
Synchronous manual trigger. Runs the full nightly pipeline and returns the run summary. Useful for staging / backfill / dashboards. Works regardless of `EXPANSION_SCHEDULER_ENABLED`.

**Response:** see [NightlyRun fields](#nightly_runs) below — same shape as the row that gets written.

### GET `/api/expansion/runs?limit=10`
Most recent `limit` nightly runs, newest first.

### GET `/api/expansion/popular?threshold=10&days=30`
Topics with `> threshold` searches in the last `days` days, ordered by count desc.

### GET `/api/expansion/aliases?limit=100`
Active TopicAlias rows for the dashboard.

### GET `/api/expansion/keywords?topic=photosynthesis`
Indexed keywords grouped by topic. Omit `topic` to get all.

### GET `/api/expansion/stats`
Today's spend on the `expansion` and `branching` budgets:
```json
{
  "today_costs": {
    "expansion": {"budget_ngn": 0.5, "spent_ngn": 0.26, "remaining_ngn": 0.24},
    "branching": {"budget_ngn": 0.5, "spent_ngn": 0.30, "remaining_ngn": 0.20}
  }
}
```

---

## Database

### `search_events`
| Column | Notes |
|---|---|
| `query_normalized`, idx | Lowercased + trimmed |
| `user_id`, idx, nullable | Anonymous searches counted |
| `source` | cache / generated / remediated |
| `average_score` | At time of search |
| `created_at`, idx | Drives the 30-day window query |

### `topic_aliases`
| Column | Notes |
|---|---|
| `alias_query`, idx | The non-canonical query |
| `canonical_query`, idx | What it should be normalized to |
| `similarity_score` | Claude's 0–1 confidence |
| `is_active`, idx | Soft-deleted when re-clustered |

### `topic_keywords`
| Column | Notes |
|---|---|
| `topic_query`, idx | Lowercased topic |
| `keyword`, idx | Single word or 2-word phrase, lowercased |

Re-indexing a topic deletes prior rows for that `topic_query`.

### `nightly_runs`
One row per orchestrator invocation. Columns: `started_at`, `finished_at`, `duration_seconds`, `distinct_queries_scanned`, `aliases_created`, `popular_topics_count`, `keywords_extracted`, `topics_expanded`, `expansion_cost_ngn`, `branching_cost_ngn`, `skipped_budget`, `errors` (JSON list, capped at 50), `status`.

---

## Admin Dashboard

[`/admin/expansion`](../frontend/pages/admin/expansion.tsx) renders [`ExpansionDashboard.tsx`](../frontend/components/Admin/ExpansionDashboard.tsx) with:

- **Run now** button — invokes `POST /api/expansion/run-now`
- **Budget cards** — today's spend on expansion + branching budgets
- **Popular topics** list — read-only, no actions
- **Proposed aliases** table — alias → canonical with confidence (informational)
- **Recent runs** table — last 10, with status pill, duration, per-step counts, total cost

Same login-required-but-not-role-gated caveat as the other Packet 3.x admin pages.

---

## Migration to alias-aware search (deferred follow-up)

When we ship alias-aware search, the flow becomes:

```
SearchService.search_and_build_path("how plants make food"):
  1. consult TopicAlias  → maps to "photosynthesis"
  2. proceed with canonical query
  3. results cached under canonical key, served to all aliases
```

Risks to think about before wiring this:

- **Cache coherency** — aliases cached under their original names will diverge from canonical.
- **Bad cluster damage radius** — one wrong alias mapping silently redirects every learner who searches the bad query.
- **User intent loss** — analytics tracking the original query becomes harder.

Mitigation when we get there: ship a `TopicAlias.confirmed_by_admin` flag and only consult confirmed aliases.
