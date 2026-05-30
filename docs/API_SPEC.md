# LearnPath AI API Specification

## Base URL
- Development: `http://localhost:8000`
- Production: `https://api.learnpath.ai` (future)

## Authentication
- Method: Bearer token (JWT)
- Location: Authorization header
- Format: `Authorization: Bearer {token}`

## Rate Limiting
- General endpoints: 100 requests/minute
- Auth endpoints: 5 requests/minute
- Response header: `X-RateLimit-Remaining`

---

## System

### GET /health
Health check.

**Response:** 200 OK
```json
{
  "status": "ok",
  "timestamp": "2026-05-28T10:30:45.123456",
  "app": "LearnPath AI",
  "version": "0.1.0",
  "environment": "staging"
}
```

---

## YouTube — `/api/youtube`
*Packet 1.1 — YouTube API Integration*

### GET /api/youtube/search
Search YouTube for educational videos on a topic.

**Query Parameters:**
| Parameter | Type | Required | Default | Notes |
|---|---|---|---|---|
| `query` | string | Yes | — | Min 2 chars |
| `max_results` | integer | No | 10 | 1–50 |

**Response:** 200 OK
```json
[
  {
    "youtube_id": "dQw4w9WgXcQ",
    "title": "Photosynthesis Explained",
    "description": "...",
    "channel_id": "UCxxxxxxx",
    "channel_name": "Science Channel",
    "published_at": "2024-01-15T00:00:00Z",
    "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg"
  }
]
```

**Errors:**
- `400` — YOUTUBE_API_KEY not configured
- `404` — No results found
- `422` — query missing or too short

---

### GET /api/youtube/details/{youtube_id}
Fetch metadata and statistics for a specific video.

**Path Parameters:**
- `youtube_id` — YouTube video ID (e.g. `dQw4w9WgXcQ`)

**Response:** 200 OK
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "duration_seconds": 5025,
  "view_count": 1000000,
  "like_count": 50000,
  "comment_count": 1200
}
```

**Errors:**
- `400` — YOUTUBE_API_KEY not configured
- `404` — Video not found

---

### GET /api/youtube/transcript/{youtube_id}
Fetch the auto-generated or manual transcript for a video.

**Path Parameters:**
- `youtube_id` — YouTube video ID

**Response:** 200 OK
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "transcript": "Welcome to this lecture on photosynthesis...",
  "language": "en"
}
```

**Errors:**
- `404` — Transcript not available for this video

---

## EQS — `/api/eqs`
*Packet 1.2 — Educational Quality Score Engine*

### POST /api/eqs/score
Score a video on educational quality using a 14-question binary rubric evaluated by Claude Opus.

**Request:**
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "title": "Photosynthesis Explained",
  "transcript": "Welcome to this lecture...",
  "description": "Learn how plants make food"
}
```

**Response:** 200 OK
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "score": 86,
  "tier": 1,
  "tier_label": "Excellent",
  "yes_count": 12,
  "answers": [true, true, true, true, true, true, true, true, true, true, false, true, true, false],
  "reasoning": "This video presents photosynthesis clearly with strong examples..."
}
```

**Score tiers:**
| Score | Tier | Label |
|---|---|---|
| 85–100 | 1 | Excellent |
| 65–84 | 2 | Good |
| 40–64 | 3 | Fair |
| 0–39 | 4 | Poor |

**Errors:**
- `400` — CLAUDE_API_KEY not configured
- `500` — EQS scoring failed

---

## Summary — `/api/summary`
*Packet 1.3 — Summary Generation & Transcript Processing*

### POST /api/summary/generate
Generate a structured learning summary from a video transcript using Claude Sonnet.

**Request:**
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "transcript": "Welcome to this lecture on photosynthesis...",
  "title": "Photosynthesis Explained",
  "max_length": 500
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `youtube_id` | string | Yes | — |
| `transcript` | string | Yes | Min 10 chars |
| `title` | string | No | — |
| `max_length` | integer | No | 100–2000, default 500 |

**Response:** 200 OK
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "summary": "This video explains photosynthesis clearly...",
  "key_concepts": ["photosynthesis", "chlorophyll", "light reactions", "Calvin cycle", "glucose"],
  "sections": [
    { "title": "Introduction", "content": "Overview of photosynthesis" },
    { "title": "Light Reactions", "content": "How plants capture light energy" }
  ],
  "word_count": 42
}
```

**Errors:**
- `400` — CLAUDE_API_KEY not configured
- `422` — transcript missing or too short, max_length out of range
- `500` — Summary generation failed

---

## Concepts — `/api/concepts`
*Packet 1.4 — Concept Graph Generation*

### POST /api/concepts/extract
Extract learning concepts and prerequisite relationships from a video summary using Claude Opus.

**Request:**
```json
{
  "summary": "This video covers the light and dark reactions of photosynthesis...",
  "video_title": "Photosynthesis Explained"
}
```

**Response:** 200 OK
```json
{
  "concepts": [
    {
      "name": "Photosynthesis",
      "definition": "Process by which plants convert light to energy",
      "prerequisites": ["Chlorophyll", "Light Energy"]
    },
    {
      "name": "Chlorophyll",
      "definition": "Green pigment that absorbs light",
      "prerequisites": []
    }
  ],
  "topic": "Photosynthesis",
  "complexity": "intermediate",
  "algorithm_version": "v1"
}
```

**Errors:**
- `400` — CLAUDE_API_KEY not configured
- `500` — Concept extraction failed

---

### POST /api/concepts/build
Build a validated concept graph from extracted concepts. Detects and breaks cycles, then topologically sorts.

**Request:**
```json
{
  "concepts": [
    { "name": "Photosynthesis", "definition": "...", "prerequisites": ["Chlorophyll"] },
    { "name": "Chlorophyll", "definition": "...", "prerequisites": [] }
  ],
  "topic": "Photosynthesis"
}
```

**Response:** 200 OK
```json
{
  "graph": {
    "graph": {
      "Chlorophyll": { "definition": "...", "prerequisites": [], "dependents": ["Photosynthesis"] },
      "Photosynthesis": { "definition": "...", "prerequisites": ["Chlorophyll"], "dependents": [] }
    },
    "concepts": ["Photosynthesis", "Chlorophyll"],
    "topic": "Photosynthesis"
  },
  "ordered_concepts": ["Chlorophyll", "Photosynthesis"],
  "cycles_detected": false,
  "is_valid": true
}
```

---

### POST /api/concepts/sort
Topologically sort an existing concept graph (prerequisites first).

**Request:**
```json
{
  "graph": {
    "Chlorophyll": { "prerequisites": [], "dependents": ["Photosynthesis"] },
    "Photosynthesis": { "prerequisites": ["Chlorophyll"], "dependents": [] }
  }
}
```

**Response:** 200 OK
```json
{
  "ordered_concepts": ["Chlorophyll", "Photosynthesis"],
  "is_valid": true,
  "total_concepts": 2
}
```

---

## Path — `/api/path`
*Packet 1.5 — Path Assembly & Ranking*

### POST /api/path/assemble
Assemble an optimal learning path from a set of scored videos. Filters by quality (EQS ≥ 65), orders by prerequisites, trims to 15 videos max, and validates the result.

**Request:**
```json
{
  "topic_id": "550e8400-e29b-41d4-a716-446655440000",
  "videos": [
    { "video_id": "uuid-1", "eqs_score": 85, "concepts": ["Photosynthesis"] },
    { "video_id": "uuid-2", "eqs_score": 78, "concepts": ["Chlorophyll"] },
    { "video_id": "uuid-3", "eqs_score": 45, "concepts": ["Mitosis"] }
  ],
  "concept_graph": {
    "ordered_concepts": ["Chlorophyll", "Photosynthesis"]
  }
}
```

**Response:** 200 OK
```json
{
  "topic_id": "550e8400-e29b-41d4-a716-446655440000",
  "video_sequence": ["uuid-2", "uuid-1"],
  "algorithm_version": "v1",
  "average_score": 81.5,
  "video_count": 2,
  "is_quality": true,
  "generated_at": "2026-05-28T10:30:45.123456",
  "validation": {
    "is_valid": false,
    "issues": ["Too few videos (2 < 3)"],
    "warnings": []
  }
}
```

**Notes:**
- Videos with EQS < 65 are filtered out before assembly
- Max path length: 15 videos
- Quality threshold: average EQS ≥ 70

**Errors:**
- `500` — Path assembly failed

---

### POST /api/path/validate
Validate a previously assembled path for length, quality, and duplicates.

**Request:**
```json
{
  "video_sequence": ["uuid-1", "uuid-2", "uuid-3"],
  "video_count": 3,
  "average_score": 80.0
}
```

**Response:** 200 OK
```json
{
  "is_valid": true,
  "issues": [],
  "warnings": []
}
```

**Validation rules:**
| Rule | Condition | Result |
|---|---|---|
| Minimum length | `video_count < 3` | Issue (invalid) |
| Maximum length | `video_count > 15` | Warning |
| Quality floor | `average_score < 70` | Issue (invalid) |
| No duplicates | Duplicate video IDs | Issue (invalid) |

---

## Cache — `/api/cache`
*Packet 1.6 — Two-Layer Caching System*

These are admin/ops endpoints. Add authentication before exposing in production.

### GET /api/cache/stats
Return live cache performance statistics. Target hit rate in production: ≥ 95%.

**Response:** 200 OK
```json
{
  "hits": 142,
  "misses": 8,
  "total_requests": 150,
  "hit_rate_percent": 94.67,
  "topic_cache_size": 12,
  "query_cache_size": 34,
  "memory_cache_size": 46
}
```

---

### GET /api/cache/topics
List all topic IDs currently held in the Layer 1 topic cache.

**Response:** 200 OK
```json
{
  "cached_topics": ["photosynthesis", "mitosis", "algebra"],
  "count": 3
}
```

---

### POST /api/cache/clear
Wipe both cache layers and reset hit/miss counters. Use after a bulk EQS re-score.

**Response:** 200 OK
```json
{ "message": "Both cache layers cleared", "status": "ok" }
```

---

### POST /api/cache/invalidate/{topic_id}
Remove a specific topic from Layer 1 cache. Call when EQS scores change for that topic.

**Path Parameters:**
- `topic_id` — Topic identifier (string)

**Response:** 200 OK
```json
{
  "topic_id": "photosynthesis",
  "invalidated": true,
  "message": "Cache entry for 'photosynthesis' removed"
}
```

**Cache architecture:**

| Layer | Key | Value | TTL | Storage |
|---|---|---|---|---|
| Layer 1 (Topic) | `topic_id` | Assembled learning path | 30 days | In-memory (DB in future) |
| Layer 2 (Query) | Normalised query string | `topic_id` | 7 days | In-memory |

**Pipeline cache flow:**
```
User query "Photosynthesis"
  → Layer 2 check: "photosynthesis" → topic_id?
    → HIT: Layer 1 check: topic_id → path?
        → HIT:  return cached path (<100ms)
        → MISS: run full pipeline, cache result
    → MISS: run full pipeline, cache both layers
```

---

## Authentication — `/api/auth`
*Packet 2.1 — JWT Authentication*

### POST /api/auth/signup
Register a new user and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Secure@123",
  "full_name": "Alex Johnson"
}
```

**Response:** 201 Created
```json
{
  "user": { "id": "uuid", "email": "...", "full_name": "...", "tier": "free", "email_verified": false, "created_at": "...", "updated_at": "..." },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:**
- `400` — Email already registered, or password fails requirements
- `422` — Missing fields or password < 8 chars

---

### POST /api/auth/login
Authenticate a user and receive tokens.

**Request:**
```json
{ "email": "user@example.com", "password": "Secure@123" }
```

**Response:** 200 OK
```json
{ "user": { ... }, "access_token": "eyJ...", "token_type": "bearer" }
```
Refresh token delivered via `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax`

**Errors:**
- `401` — Invalid email or password
- `403` — Account deactivated

---

### POST /api/auth/refresh
Get a new access token using the HTTP-only refresh token cookie (sent automatically).

**Response:** 200 OK
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

**Errors:** `401` — Missing, invalid, or expired refresh token

---

### POST /api/auth/logout
Clear the refresh token cookie.

**Response:** 200 OK
```json
{ "message": "Logged out successfully" }
```

---

### GET /api/auth/me
Return the current authenticated user.

**Headers:** `Authorization: Bearer {access_token}`

**Response:** 200 OK — `UserResponse` schema

**Errors:** `401` — Not authenticated or token expired

---

**Password requirements:** ≥ 8 chars, uppercase, lowercase, number, special character.
**Token TTLs:** access = 15 min, refresh = 7 days (HTTP-only cookie).

See [AUTHENTICATION.md](AUTHENTICATION.md) for full details.

---

## Concept Branching (Packet 3.1)

Splits a concept into 3–5 progressive learning branches via Claude Opus. Generated branches are cached in the `concept_branches` table for 30 days.

### GET `/api/branching/{concept_name}`
Returns cached branches, or generates them on cache miss.

**Query params:**
- `base_concept_summary` (optional) — extra context for Claude on first generation.

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
- `400` — empty concept name
- `429` — daily branching budget (₦0.50) exhausted
- `502` — Claude returned a set that failed validation (count out of 3–5, non-monotonic difficulty, or unknown prerequisite)

### POST `/api/branching/{concept_name}/regenerate`
Admin: force-regenerate, bypassing the cache. Same response/error shapes as the GET. Body: `{base_concept_summary, force_regenerate}`.

### POST `/api/branching/{concept_name}/branches/{branch_id}/learning-path`
Stub for Packet 3.1 — returns `{branch_id, branch_title, status: "not_yet_implemented"}`. Real branch-scoped path assembly arrives in a follow-up packet.

### POST `/api/branching/validate`
Admin: validate a candidate branch set without persisting. Body: `{branches: [...]}`. Returns `{is_valid, issues}`.

### GET `/api/branching/admin/cost-stats`
Returns per-feature daily spend and remaining budget (NGN).

See [CONCEPT_BRANCHING.md](CONCEPT_BRANCHING.md) for full details.

---

## Blacklist System (Packet 3.2)

Soft/hard video blacklist with auto-trigger from EQS scoring, lazy re-evaluation, shadow testing, and an admin dashboard. Keyed by `youtube_id` (string). Admin endpoints are login-required but not role-gated — see [BLACKLIST_SYSTEM.md](BLACKLIST_SYSTEM.md) for the gap.

### POST `/api/blacklist`
Manually blacklist a video.

**Body:**
```json
{ "youtube_id": "abc123", "reason": "Inaccurate content", "blacklist_type": "hard" }
```

**Response:**
```json
{
  "youtube_id": "abc123",
  "blacklist_type": "hard",
  "blacklist_date": "2026-05-30T...",
  "retry_date": null
}
```

### DELETE `/api/blacklist/{youtube_id}`
Lift active blacklist. Returns `404` if none.

### PATCH `/api/blacklist/{youtube_id}`
Convert soft↔hard. Body: `{ blacklist_type: "soft"|"hard", reason? }`.

### GET `/api/blacklist/status/{youtube_id}`
Returns `{is_blacklisted, blacklist_type, reason, last_score, blacklist_date, retry_date, expired}`. Soft blacklists past `retry_date` return `is_blacklisted: false`.

### GET `/api/blacklist?blacklist_type=soft&limit=100&offset=0`
List active blacklist rows with per-row feedback aggregates.

### POST `/api/blacklist/auto-blacklist-low-scores?score_threshold=65`
Batch scan `video_scores` and create soft-blacklist rows for low-EQS youtube_ids not already blacklisted.

### POST `/api/blacklist/re-evaluate?limit=100`
Re-score expired soft blacklists via EQS. Returns `{evaluated, lifted, extended, errors, skipped_budget, total_expired}`. Budget-gated through `cost_tracker("blacklist_reeval")` — ₦0.50/day.

### POST `/api/blacklist/feedback`
**Body:** `{youtube_id, rating: 1-5, feedback?, helpful?, user_id?}`.

### GET `/api/blacklist/stats`
Aggregates: `total_active`, `soft`, `hard`, `pending_re_evaluation`, `feedback_count`, `feedback_avg_rating`.

### GET `/api/blacklist/shadow-test/{user_id}`
Diagnostic: returns `{user_id, is_shadow_tester}`. Used to verify the 1-in-10 distribution.

### Search pipeline impact

`POST /api/search/build-path` now threads the authenticated `user_id` and `db` session into `SearchService.search_and_build_path`. The pipeline pre-filters blacklisted videos before EQS scoring (saving Claude tokens) and auto-creates soft-blacklist rows for any video that scores below 65. Shadow-test users bypass the pre-filter so they can submit feedback.

See [BLACKLIST_SYSTEM.md](BLACKLIST_SYSTEM.md) for full details.

---

## Expanded EQS Scoring (Packet 3.3)

11-criteria educational quality scoring (0–170 points) with score-dependent cache TTL. Coexists with the legacy `/api/eqs/score` endpoint — search pipeline still uses the 0-100 EQS; this is a parallel rail consumed by the confidence dashboard.

### POST `/api/eqs/expanded/score`
Score a video on the 11-criterion rubric.

**Body:**
```json
{
  "youtube_id": "abc123",
  "video_summary": "...",
  "title": "optional",
  "transcript_excerpt": "optional, first 2000 chars used"
}
```

**Response:** `{id, youtube_id, base_scores, bonus_scores, base_score, bonus_total, total_score, confidence_level, cache_ttl_days, reasoning, cost_remaining_ngn}`

**Errors:**
- `400` — summary too short (<10 chars) or missing key
- `429` — daily `eqs_expanded` budget (₦0.50) exhausted
- `502` — Claude returned malformed scoring JSON

### GET `/api/eqs/expanded/list`
List active expanded scores with optional `confidence_level` filter and pagination.

### GET `/api/eqs/expanded/stats`
Aggregate statistics: `total_scored`, `average_score`, `median_score`, `distribution` (by confidence level), `criteria_averages` (per-criterion), `cache_distribution`.

See [CONFIDENCE_SCORING_EXPANDED.md](CONFIDENCE_SCORING_EXPANDED.md) for the full breakdown of criteria weights, confidence levels, and TTL ladder.

---

## Auto-Remediation (Packet 3.4)

Opt-in 3-tier fallback for paths with `average_score < 60`. Tier 1 = Claude variant queries, Tier 2 = Gemini variant queries, Tier 3 = original path with "best available" notification. Each tier raises `BudgetExceeded` to the next when the daily `remediation` budget (₦0.50) is spent.

### POST `/api/remediation/auto-remediate`
Requires authentication. Always writes a `remediation_events` row.

**Body:**
```json
{
  "query": "addition for kids",
  "original_score": 45,
  "original_path": { "...opaque, returned in fallback...": "" }
}
```

**Response:** `{success, tier_used, original_score, remediated_score, variant_query, notification: {state, message}, duration_seconds, path}`

**Errors:**
- `400` — `original_score >= 60` (caller shouldn't have triggered)
- `401` — Not authenticated
- `500` — Unrecoverable error

### GET `/api/remediation/stats`
Admin: aggregate counts, per-tier success rates, average duration, and top remediated queries.

See [AUTO_REMEDIATION.md](AUTO_REMEDIATION.md) for the full design.

---

## Error Responses

### 400 Bad Request
```json
{ "detail": "CLAUDE_API_KEY not configured" }
```

### 422 Unprocessable Entity
```json
{
  "detail": [
    { "loc": ["body", "transcript"], "msg": "String should have at least 10 characters", "type": "string_too_short" }
  ]
}
```

### 500 Internal Server Error
```json
{ "detail": "EQS scoring failed: <reason>" }
```

---

## Interactive Docs

FastAPI auto-generates full interactive documentation:
- Swagger UI: `GET /docs`
- ReDoc: `GET /redoc`
- OpenAPI JSON: `GET /openapi.json`
