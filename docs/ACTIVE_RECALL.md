# Active Recall & Spaced Repetition

## Overview

Active recall is the practice of retrieving information from memory rather than passively re-reading it. Research consistently shows that testing yourself on material — even imperfectly — dramatically improves long-term retention compared to passive review.

LearnPath AI pairs active recall with **spaced repetition**: concepts are scheduled for review at increasing intervals (3 → 7 → 30 days for material you know, 1 → 3 days for material that needs reinforcement). This matches how human memory decays, ensuring you review things just before you would forget them.

---

## How It Works (User Flow)

1. User watches a video to ≥ 90 % completion
2. Claude generates a comprehension question tailored to that video's summary and concept
3. User reads the question, types their answer, and sets a confidence rating (1–5 stars)
4. Claude evaluates the answer and returns a score (0–100) with feedback
5. The FeedbackCard shows score, explanation, and a key insight
6. User clicks **Continue** → navigates to the next video (or dashboard on path completion)
7. The concept is scheduled for spaced-repetition review based on correctness

---

## API Endpoints

All endpoints require a valid `Authorization: Bearer <access_token>` header.

### POST `/api/questions/generate`

Generate a comprehension question from a video summary.

**Request:**
```json
{
  "video_summary": "This video explains how plants convert sunlight into chemical energy...",
  "concept_name": "Photosynthesis",
  "difficulty": "medium"
}
```

**Response:**
```json
{
  "question": "How does chlorophyll enable energy conversion in photosynthesis?",
  "type": "free_text",
  "options": null,
  "correct_answer": "Chlorophyll absorbs light energy (primarily red and blue wavelengths) and uses it to drive the light-dependent reactions, converting ADP to ATP.",
  "explanation": "Chlorophyll is the key pigment that captures photons and initiates the electron transport chain.",
  "difficulty": "medium",
  "estimated_time_seconds": 120
}
```

`difficulty` values: `easy` | `medium` | `hard`
`type` values: `free_text` | `multiple_choice`

---

### POST `/api/questions/evaluate`

Evaluate a student's answer using Claude.

**Request:**
```json
{
  "question": "How does chlorophyll enable energy conversion?",
  "correct_answer": "Chlorophyll absorbs light and drives the electron transport chain...",
  "student_answer": "Chlorophyll captures sunlight and turns it into energy the plant can use",
  "difficulty": "medium"
}
```

**Response:**
```json
{
  "is_correct": true,
  "score": 78,
  "explanation": "Correctly identifies the role of chlorophyll in capturing light, but misses the specific mechanism (electron transport chain, ATP production).",
  "feedback": "Great start! You've grasped the core idea. Adding the biochemical pathway would make this a perfect answer.",
  "next_difficulty": "same",
  "key_insight": "Chlorophyll's absorption spectrum (peaking at ~430 nm and ~680 nm) is what makes plants appear green — they reflect the wavelengths they don't use."
}
```

**Scoring rubric:**

| Range | Label | Meaning |
|-------|-------|---------|
| 80–100 | Correct | Answer captures the core concept correctly |
| 51–79 | Partial | Correct direction but missing key detail or precision |
| 0–50 | Incorrect | Off-topic, too vague, or fundamentally wrong |

`next_difficulty` values: `easier` | `same` | `harder`

---

### POST `/api/questions/schedule`

Schedule the next spaced-repetition review for a concept.

**Request:**
```json
{
  "concept_name": "Photosynthesis",
  "is_correct": true,
  "times_reviewed": 1
}
```

**Response:**
```json
{
  "review_date": "2026-06-04T14:23:00.000000",
  "interval_days": 7,
  "times_reviewed": 2
}
```

---

### GET `/api/questions/due/{user_id}`

List all concepts due for review (spaced repetition queue).

**Response:**
```json
[
  {
    "concept_name": "Gradient Descent",
    "question": "Why does gradient descent need a learning rate?",
    "times_reviewed": 2,
    "next_review_at": "2026-05-28T09:00:00.000000"
  }
]
```

---

### POST `/api/questions/explanation`

Generate a conceptual explanation tailored to the student's answer.

**Request:**
```json
{
  "answer": "Plants use sunlight to make food",
  "concept_name": "Photosynthesis"
}
```

**Response:**
```json
{
  "explanation": "You're right that sunlight is the energy source. To go deeper: photosynthesis has two stages — the light-dependent reactions (in the thylakoid membranes) that convert light to ATP and NADPH, and the Calvin cycle (in the stroma) that uses those molecules to fix CO₂ into glucose. The 'food' plants make is glucose, stored as starch."
}
```

---

## Question Generation

Claude receives the video summary and concept name, then produces a question that:

- **Tests understanding, not memorization** — the question cannot be answered by copying a sentence from the transcript
- **Has a single clearly correct answer** — avoids ambiguity or opinion-based questions
- **Is calibrated to difficulty level** — easy questions test recognition, hard questions require synthesis or application
- **Encourages reflection** — worded to provoke thinking, not recall

### Prompt structure

```
Create a comprehension question testing understanding of {concept_name}.
Video summary: {video_summary}

The question should:
1. Test conceptual understanding, not memorization
2. Be unanswerable by searching the transcript verbatim
3. Have one clearly correct answer
4. Be at {difficulty} difficulty for a motivated learner

Respond ONLY in JSON: { "question", "type", "correct_answer", "explanation", "difficulty", "estimated_time_seconds" }
```

---

## Answer Evaluation

Claude acts as an encouraging tutor that grades the student's answer against the model answer.

### What Claude evaluates

1. **Conceptual correctness** — does the student understand the core idea?
2. **Completeness** — have they covered the key aspects?
3. **Precision** — is their vocabulary appropriate to the difficulty level?

### Scoring

The score (0–100) is determined by Claude based on the rubric above. The backend clamps the raw score to [0, 100] regardless of what Claude returns.

### Adaptive difficulty

After each answer, Claude returns `next_difficulty` (`easier` | `same` | `harder`). This allows the question generation system to adjust future question difficulty:
- Correct + confident → harder
- Partially correct → same
- Incorrect → easier

---

## Spaced Repetition Algorithm

The scheduling algorithm is based on the **SuperMemo SM-2** intuition, simplified for MVP:

| Review number | Correct interval | Incorrect interval |
|--------------|-----------------|-------------------|
| 1st review   | 3 days          | 1 day             |
| 2nd review   | 7 days          | 3 days            |
| 3rd+ review  | 30 days         | 3 days            |

If a user gets a concept wrong, the clock resets to the beginning of the incorrect schedule.

**Implementation** (in `question_service.py`):
```python
_CORRECT_INTERVALS = [3, 7, 30]
_INCORRECT_INTERVALS = [1, 3]

def schedule_next_review(concept_name, is_correct, times_reviewed):
    schedule = _CORRECT_INTERVALS if is_correct else _INCORRECT_INTERVALS
    idx = min(times_reviewed, len(schedule) - 1)
    interval_days = schedule[idx]
    review_date = datetime.utcnow() + timedelta(days=interval_days)
    return {"review_date": ..., "interval_days": interval_days, "times_reviewed": times_reviewed + 1}
```

---

## Database Model: `QuestionAnswer`

Stores every answered question for audit, spaced repetition scheduling, and analytics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID FK | Owner |
| `topic_id` | UUID FK | Topic context |
| `concept_name` | String | Concept being tested |
| `question` | Text | The question text |
| `correct_answer` | Text | Model answer (not shown to user) |
| `student_answer` | Text | What the student typed |
| `score` | Integer | 0–100 |
| `is_correct` | Boolean | score ≥ 80 |
| `explanation` | Text | Claude's explanation |
| `feedback` | Text | Encouragement message |
| `times_reviewed` | Integer | How many times reviewed |
| `next_review_at` | DateTime | Spaced repetition due date |
| `confidence` | Integer | 1–5 self-reported confidence |
| `difficulty` | String | easy / medium / hard |
| `created_at` | DateTime | When answered |

---

## Frontend Components

### `QuestionCard`

`frontend/components/Learning/QuestionCard.tsx`

Displays the question and handles submission. After the user submits, it calls `/api/questions/evaluate` and transitions to `FeedbackCard` inline.

Props:
- `question` — question text
- `questionType` — `free_text` | `multiple_choice`
- `options` — array of option strings (multiple choice only)
- `correctAnswer` — passed for evaluation; never displayed to the user
- `difficulty` — controls the difficulty badge color
- `estimatedTime` — shown as "X min" in the header
- `onAnswerSubmit(score, feedback)` — fires when user clicks **Continue** after seeing feedback
- `onSkip` — optional skip button

### `FeedbackCard`

`frontend/components/Learning/FeedbackCard.tsx`

Shows score, explanation, encouragement, and key insight after evaluation.

Props:
- `score` — 0–100 (drives the animated ring and colour)
- `isCorrect` — toggles icon and label (✓ / ⚠ / ✗)
- `explanation` — Claude's explanation of the score
- `feedback` — 2-sentence encouragement
- `keyInsight` — single most important concept to understand
- `onContinue` — fires when user clicks **Continue**

---

## Design Decisions

**Why not store correct_answer server-side?**
For the MVP, the correct answer is returned to the frontend and sent back at evaluation time. This avoids a session-state lookup but means a determined user could inspect it in devtools. In a production hardening pass, the server would store the question+answer pair and the client would only send a `question_session_id`.

**Why free-text over multiple choice?**
Research shows free-text recall is significantly more effective than recognition (multiple choice) for building durable memory. Multiple choice is available for accessibility, but free-text is the default.

**Why not use a deterministic SRS formula (SM-2)?**
The simplified three-interval schedule is easier to reason about and sufficient for the current scale. Full SM-2 (with EF factor) is planned for Packet 2.5.

---

## Metrics

To measure system effectiveness, track:

| Metric | Target |
|--------|--------|
| Average score per concept | > 70 after 3 reviews |
| Streak retention | > 80 % of users return on scheduled day |
| Difficulty distribution | 40 % easy, 40 % medium, 20 % hard |
| Skip rate | < 20 % (high skip = question too hard or flow broken) |
| Time-to-answer | < 3 min median (longer = question too complex) |

---

## Troubleshooting

**Question doesn't appear after video completes**

- Check `CLAUDE_API_KEY` is set in `.env`
- The fallback panel shows if the API call fails — this is expected without a key
- Check browser console for `POST /api/questions/generate` errors

**Score always 0 or missing**

- Verify the `correct_answer` field is being passed from the generation response to the evaluation request
- Check backend logs for Claude API errors

**`ModuleNotFoundError: No module named 'anthropic'`**

- Run `pip install -r backend/requirements.txt` (production) or `pip install -r backend/requirements-ci.txt` (CI)
- Ensure `anthropic==0.28.0` is installed: `pip show anthropic`

**Integration tests fail locally**

- The `test_active_recall_flow.py` integration tests require the Python 3.11 environment (same as CI)
- Unit tests (`test_question_service.py`) run on any Python version with `anthropic` installed

---

**Last updated:** May 28, 2026
**Packet:** 2.4 — Active Recall & Spaced Repetition
