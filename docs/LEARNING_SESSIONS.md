# Learning Sessions & Video Tracking

**Packet 2.2** — Stage 2: User Layer

---

## Overview

Learning sessions track every interaction a user has with a video on a learning path — time watched, position, playback speed, post-video answers, and concept mastery. The system is designed to support spaced repetition and progress resumption (Packets 2.3+).

---

## Data Models

### PathSession

Extended in Packet 2.2 with new tracking fields.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID FK | Session owner |
| `topic_id` | UUID FK | Topic being studied |
| `video_id` | UUID FK | Optional — references videos table |
| `youtube_id` | String | YouTube video ID (always present) |
| `path_id` | String | Path identifier (FK to LearningPath added in Packet 2.3+) |
| `video_index` | Integer | Position in path (0-based) |
| `session_number` | Integer | Auto-incremented per user+topic |
| `video_watched` | Boolean | True when watch_percentage ≥ 90 |
| `watch_percentage` | Integer | Max percentage reached (monotonically increasing) |
| `last_position_seconds` | Integer | Last known playback position |
| `max_position_seconds` | Integer | Furthest point reached |
| `total_watch_time_seconds` | Integer | Cumulative active watch time |
| `playback_speed` | Float | Last used playback speed |
| `questions_answered` | Integer | Post-video questions answered |
| `questions_correct` | Integer | Correct answers (AI-graded in Packet 2.3) |
| `post_video_question` | Text | The reflection question posed |
| `post_video_answer` | Text | User's written answer |
| `answer_feedback` | Text | AI feedback (stub until Packet 2.3) |
| `answer_score` | Integer | AI score (null until Packet 2.3) |
| `started_at` | DateTime | Session start time |
| `completed_at` | DateTime | Set on explicit complete or page exit |

### ConceptProgress

Tracks mastery of individual concepts per user per topic.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID FK | Owner |
| `topic_id` | UUID FK | Topic context |
| `concept_name` | String | Human-readable concept name |
| `mastery_score` | Float | 0–100 (correct/total × 100) |
| `encounters` | Integer | How many times seen |
| `correct_answers` | Integer | Correct answers on quizzes |
| `wrong_answers` | Integer | Wrong answers on quizzes |
| `status` | String | `not_started` / `learning` / `mastered` |
| `first_seen_at` | DateTime | First encounter timestamp |
| `last_seen_at` | DateTime | Most recent encounter |

Mastery thresholds:
- **mastered**: score ≥ 80 AND encounters ≥ 3
- **learning**: at least 1 encounter
- **not_started**: no encounters yet

---

## API Endpoints

Base path: `/api/sessions`

All endpoints require a valid Bearer token (`Authorization: Bearer <access_token>`).

### POST `/api/sessions/start`

Start a new learning session.

**Request body:**
```json
{
  "topic_id": "uuid",
  "video_index": 0,
  "youtube_id": "ukzFI9rgwfU",
  "path_id": "optional-path-id",
  "video_id": "optional-uuid"
}
```

**Response (201):**
```json
{
  "session_id": "uuid",
  "session_number": 1,
  "started_at": "2026-05-28T12:00:00"
}
```

---

### PUT `/api/sessions/progress/{session_id}`

Update watch progress (sent every ~5 seconds by the frontend player).

**Request body:**
```json
{
  "watch_percentage": 45,
  "last_position_seconds": 382,
  "total_watch_time_seconds": 400,
  "playback_speed": 1.25
}
```

**Behaviour:**
- `watch_percentage` and `total_watch_time_seconds` are monotonically increasing (never go backwards)
- When `watch_percentage` ≥ 90, `video_watched` is set to `true` automatically

**Response (200):**
```json
{
  "watch_percentage": 45,
  "video_watched": false,
  "last_position_seconds": 382
}
```

---

### POST `/api/sessions/answer/{session_id}`

Submit a post-video reflection answer.

**Request body:**
```json
{
  "question": "What was the most important concept?",
  "answer": "The gradient descent algorithm minimises loss by..."
}
```

**Response (200):**
```json
{
  "feedback": "Answer recorded. AI-powered feedback coming soon.",
  "score": null,
  "questions_answered": 1
}
```

> AI grading is stubbed — it will be wired to `question_service` in Packet 2.3.

---

### POST `/api/sessions/complete/{session_id}`

Mark a session as complete (called on video end or navigation away).

**Response (200):**
```json
{
  "completed": true,
  "completed_at": "2026-05-28T12:15:30",
  "video_watched": true,
  "watch_percentage": 95,
  "total_watch_time_seconds": 810
}
```

---

### GET `/api/sessions/progress/{topic_id}`

Get aggregate progress for a user on a topic.

**Response (200):**
```json
{
  "topic_id": "uuid",
  "path_id": null,
  "total_sessions": 4,
  "completed_sessions": 2,
  "completion_percentage": 50.0,
  "total_watch_time_seconds": 3240,
  "concepts_mastered": 3
}
```

---

### GET `/api/sessions/{session_id}`

Get a specific session (for progress resumption).

**Response (200):** `SessionResponse` schema — all fields from `PathSession`.

---

## Frontend Components

### `VideoPlayer`

**Path:** `frontend/components/Learning/VideoPlayer.tsx`

A custom React player built on top of the YouTube IFrame API. The native YouTube controls are hidden; all UI is custom-rendered.

**Features:**
- Play/pause (click video or Space/K)
- Seek: progress bar click, ← (−10s), → (+10s)
- Volume: slider + M to mute
- Speed selector: 0.5× → 2× in 7 steps
- Fullscreen: button or F key
- Progress + buffered bar with scrubber
- Idle controls auto-hide after 3s when playing
- Keyboard shortcut cheatsheet on hover
- Reports progress to parent via `onProgress(pct, positionSeconds, watchTimeSeconds)` every 1s
- Fires `onComplete()` at 90% watched

**Props:**
```typescript
interface VideoPlayerProps {
  youtubeId: string;
  initialPosition?: number;
  onProgress?: (pct: number, positionSeconds: number, watchTimeSeconds: number) => void;
  onComplete?: () => void;
  onReady?: (duration: number) => void;
}
```

---

### `ProgressTracker`

**Path:** `frontend/components/Learning/ProgressTracker.tsx`

Displays overall path progress and the full video list with watch status.

**Features:**
- Circular progress indicator (CSS SVG)
- Per-video status badges: not started / in progress / completed
- Mini progress bar per video
- Live "currently playing" animation bars
- Watch time summary
- Click to navigate between videos

---

### `ConceptSidebar`

**Path:** `frontend/components/Learning/ConceptSidebar.tsx`

Tabbed sidebar with Concepts and Notes panels.

**Features:**
- Concept mastery bars (green at ≥80%, indigo in progress)
- Expandable concept descriptions
- Status labels: New / Learning / Mastered
- Free-text notes textarea with character count
- Empty state when no concepts have been loaded yet

---

### Learning Session Page

**Path:** `frontend/pages/learning/[pathId]/[videoIndex].tsx`

Two-column layout: video + controls on the left, sidebar on the right.

**Features:**
- Sticky header with breadcrumb + sidebar toggle
- Auto-starts a session via `POST /api/sessions/start` on load
- Debounced progress updates every 5s to `PUT /api/sessions/progress/{id}`
- Shows reflection question panel after video completes
- Prev/Next video navigation
- Mobile-responsive: sidebar collapses into bottom stack
- Graceful degradation when unauthenticated (videos still play)

---

## Session Lifecycle

```
User opens /learning/{pathId}/{videoIndex}
    ↓
POST /api/sessions/start
    ↓
Video plays → PUT /api/sessions/progress every 5s
    ↓
watch_percentage reaches 90% → video_watched = true
    ↓
onComplete fires → POST /api/sessions/complete
    ↓
Reflection question shown → POST /api/sessions/answer
    ↓
User navigates to next video → repeat
```

---

## Tests

**File:** `backend/tests/unit/test_session_service.py`

17 unit tests across 5 test classes:

| Class | Tests |
|-------|-------|
| `TestStartSession` | Creates session, increments session_number, stores path_id |
| `TestUpdateWatchProgress` | Not found → None, percentage monotonic, watched threshold, time monotonic |
| `TestSubmitAnswer` | Not found → None, records Q&A, increments counter |
| `TestCompleteSession` | Sets completed_at, not found → None, marks video_watched |
| `TestGetSessionProgress` | Empty result, completion %, total watch time |

All 73 applicable unit tests pass on CI (Python 3.11).

---

## Pending (Packet 2.3+)

- AI-graded answers via `question_service`
- Spaced repetition scheduler
- `LearningPath` model + FK from `PathSession.path_id`
- Concept extraction from video transcripts
- Adaptive difficulty based on `ConceptProgress.mastery_score`
