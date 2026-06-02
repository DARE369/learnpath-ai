# NEW-PACKET-C: Interactive Quiz System with Adaptive Difficulty

## Overview

NEW-PACKET-C introduces an intelligent quiz system that uses **Item Response Theory (IRT)** to adapt question difficulty in real-time based on learner performance. The system tracks confidence separately from correctness and provides immediate, detailed feedback.

### Key Features

1. **Adaptive Difficulty** - Questions automatically adjust to 60-65% success rate (optimal learning zone)
2. **Confidence Tracking** - Separate confidence ratings to detect overconfidence
3. **Immediate Feedback** - Real-time explanations for correct and incorrect answers
4. **Performance Analytics** - Detailed breakdown per concept with weak area identification
5. **Spaced Repetition** - Failed questions automatically scheduled for optimal retention (FSRS)
6. **Peer Comparison** - Percentile ranking to motivate learners

---

## Architecture

### Database Schema

#### quiz_sessions
Groups all questions in one quiz attempt.

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key → users)
- topic_id: UUID (foreign key → topics)
- quiz_type: VARCHAR(50) -- section | module | full_path | mock_exam
- total_questions: INTEGER
- questions_answered: INTEGER
- correct_answers: INTEGER
- score_percent: INTEGER
- estimated_ability: FLOAT -- IRT theta (θ) estimate
- performance_level: VARCHAR(50) -- below_average | average | above_average | expert
- weak_concepts: TEXT[] -- concepts where user scored <60%
- strong_concepts: TEXT[] -- concepts where user scored >80%
- session_started_at: TIMESTAMP
- session_completed_at: TIMESTAMP
```

#### quiz_questions
Question pool with IRT parameters.

```sql
- id: UUID (primary key)
- topic_id: UUID (foreign key → topics)
- question_text: TEXT
- question_type: VARCHAR(50) -- multiple_choice | true_false | short_answer
- options: JSONB -- [{"text": "A", "correct": true, "id": "A"}, ...]
- difficulty_parameter: FLOAT -- IRT 'b' (-3 to +3, lower = easier)
- discrimination_parameter: FLOAT -- IRT 'a' (how well it measures ability)
- correct_answer_id: VARCHAR(10)
- explanation: TEXT
- explanation_for_each_option: JSONB -- {"A": "Why...", "B": "Why...", ...}
- concept_id: VARCHAR(100) -- link to knowledge concept
- tags: TEXT[] -- e.g., ['ielts', 'listening', 'difficult']
```

#### quiz_responses
Individual answer records for IRT + analytics.

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key → users)
- quiz_session_id: UUID (foreign key → quiz_sessions)
- question_id: UUID (foreign key → quiz_questions)
- user_answer_id: VARCHAR(10)
- is_correct: BOOLEAN
- confidence_rating: INTEGER (1-10 scale)
- confidence_appropriate: BOOLEAN (matches correctness?)
- time_spent_seconds: INTEGER
- learner_ability_before: FLOAT -- θ before this Q
- learner_ability_after: FLOAT -- θ after this Q
```

#### concept_mastery
Aggregate mastery per concept.

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key → users)
- concept_id: VARCHAR(100)
- questions_attempted: INTEGER
- questions_correct: INTEGER
- accuracy_percent: INTEGER
- is_mastered: BOOLEAN -- >80% accuracy
- mastered_date: TIMESTAMP
```

#### fsrs_cards
Spaced repetition scheduling for failed questions.

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key → users)
- source_type: VARCHAR(50) -- quiz_question | flashcard
- source_id: UUID
- state: VARCHAR(50) -- new | learning | reviewing | relearning
- due_date: TIMESTAMP -- when to show next
- stability: FLOAT -- resistance to forgetting
- difficulty: FLOAT -- estimated difficulty (0-10)
- reps: INTEGER -- number of reviews
- lapses: INTEGER -- number of failures
```

---

## Backend API

### Endpoints

#### POST /api/quiz/start
Start a new quiz session.

**Parameters:**
- `quiz_type` (query): "section" | "module" | "full_path" | "mock_exam" (default: "section")
- `topic_id` (query): Optional topic UUID for section quizzes

**Response:**
```json
{
  "session_id": "uuid",
  "question": {
    "id": "uuid",
    "text": "What is the capital of France?",
    "type": "multiple_choice",
    "options": [
      {"text": "Paris", "id": "A"},
      {"text": "London", "id": "B"}
    ],
    "concept": "geography_capitals"
  },
  "question_number": 1,
  "total_questions": 5
}
```

#### POST /api/quiz/{session_id}/answer
Submit an answer to a quiz question.

**Body:**
```json
{
  "question_id": "uuid",
  "answer": "A",
  "confidence": 7,
  "time_spent": 30
}
```

**Response:**
```json
{
  "is_correct": true,
  "explanation": "Paris is the capital of France.",
  "explanation_for_choice": "Correct! Paris is the capital.",
  "confidence_feedback": "Well-calibrated! ✓",
  "ability_updated": 0.25,
  "next_question": { ... },
  "question_number": 2,
  "quiz_complete": false
}
```

When quiz is complete:
```json
{
  "is_correct": true,
  "quiz_complete": true,
  "results": {
    "session_id": "uuid",
    "score_percent": 80,
    "correct_answers": 4,
    "total_questions": 5,
    "performance_level": "above_average",
    "weak_concepts": ["concept_x"],
    "strong_concepts": ["concept_y"],
    "recommendation": "Excellent work!...",
    "percentile": 75,
    "time_spent_seconds": 180,
    "next_actions": [...]
  }
}
```

#### GET /api/quiz/{session_id}/results
Get detailed quiz results.

**Response:**
```json
{
  "id": "uuid",
  "score": 80,
  "level": "above_average",
  "recommendation": "Excellent work!...",
  "weak_concepts": ["concept_x"],
  "strong_concepts": ["concept_y"],
  "total_time_seconds": 180,
  "completed_at": "2026-06-02T15:30:00"
}
```

---

## IRT Algorithm

### Item Response Theory (IRT)

The system uses the **Rasch model** to estimate learner ability and adjust question difficulty.

#### Mathematical Model

```
P(correct) = 1 / (1 + e^(-1.7 * a * (θ - b)))

Where:
  θ = learner ability (estimated, starts at 0.0)
  a = discrimination parameter (how well it measures θ)
  b = difficulty parameter (center point)
  P = probability of answering correctly (target: 0.65)
```

#### Ability Estimation

On each question, the system updates `θ` using a Bayesian update:

```
If correct:
  θ_new = θ_old + learning_rate * 0.5

If incorrect:
  θ_new = θ_old - learning_rate * 0.5

where learning_rate = 0.3 / (1 + fisher_information)
```

Learning rate is **higher for less informative questions** (closer to 50-50).

#### Question Selection

The system selects the next question by:
1. Scoring all available questions by difficulty match: `1.0 - |P(correct) - 0.65|`
2. Selecting the question with highest score (closest to 65% success rate)

---

## Service: QuizEngineService

### Key Methods

```python
async def start_quiz_session(db, user_id, quiz_type, topic_id)
  # Initialize new quiz, select first question

async def submit_answer(db, session_id, question_id, user_answer, confidence, time_spent, user_id)
  # Process answer, update ability, save response, check for FSRS

async def complete_quiz_session(db, session_id, user_id)
  # Finalize quiz, calculate analytics, update concept mastery

async def _select_next_question(db, user_id, current_ability, quiz_type, topic_id)
  # IRT-based question selection

async def _update_ability_estimate(current_ability, question, is_correct)
  # Bayesian ability update

async def _add_to_spaced_repetition(db, user_id, question_id, source_type)
  # Schedule failed question for FSRS
```

---

## Frontend Components

### QuizInterface.tsx
Main quiz component. Handles:
- Question rendering and option selection
- Confidence slider (1-10)
- Real-time feedback on submit
- Question progression with IRT selection

### QuizResults.tsx
Results screen showing:
- Overall score and percentile
- Performance level (emoji + label)
- Weak/strong concepts
- Time spent statistics
- Next action buttons

### QuizModal.tsx
Modal wrapper for embedding quizzes in dashboard or pages.

### QuestionCard.tsx
Reusable component for standalone question practice.

---

## Integration

### Dashboard Integration

Quiz button in "Today's goal" section:
```tsx
<button onClick={() => setQuizModalOpen(true)}>
  🎯 Take a Quick Quiz
</button>

<QuizModal isOpen={quizModalOpen} onClose={() => setQuizModalOpen(false)} />
```

### Course Integration

Add quiz after each video:
```tsx
<Button onClick={() => startQuiz(videoId)} variant="primary">
  Test Your Knowledge
</Button>
```

---

## Configuration

### Environment Variables

None required. Quiz system works with existing auth/database setup.

### Feature Flags

Quizzes are always enabled. No rate limiting applied (uses existing free-tier limits if needed).

---

## Testing

### Unit Tests

Located in `tests/test_quiz_engine.py`:

- `test_start_quiz_session` - Session initialization
- `test_irt_probability_calculation` - IRT math verification
- `test_ability_update_correct` - Ability increases on correct answer
- `test_ability_update_incorrect` - Ability decreases on incorrect answer
- `test_confidence_calibration_*` - Confidence matching logic
- `test_submit_answer` - Answer submission flow
- `test_complete_quiz_session` - Quiz finalization and analytics

### Manual Testing

1. **Seed questions:**
   ```bash
   python backend/scripts/seed_quiz_questions.py
   ```

2. **Run migrations:**
   ```bash
   psql -d <DATABASE_URL> -f backend/migrations/add_quiz_tables.sql
   ```

3. **Test API endpoints:**
   ```bash
   # Start quiz
   curl -X POST http://localhost:8000/api/quiz/start \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json"

   # Submit answer
   curl -X POST http://localhost:8000/api/quiz/{session_id}/answer \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "question_id": "...",
       "answer": "A",
       "confidence": 7,
       "time_spent": 30
     }'
   ```

---

## Success Metrics (30 days post-launch)

- **Quiz engagement:** 80%+ of users take quiz when offered
- **Average quiz score:** 60-70% (optimal difficulty achieved)
- **Confidence calibration:** 70%+ well-calibrated users
- **Quiz repeat rate:** 40%+ retake quizzes
- **Learning improvement:** +15% avg improvement on retakes
- **IRT effectiveness:** 95%+ report difficulty as "just right"

---

## Future Enhancements

1. **Advanced FSRS:** Implement full FSRS v3 algorithm with multiple review states
2. **Custom Quiz Creation:** Allow teachers/admins to create quizzes
3. **Quiz Analytics Dashboard:** Detailed per-user and cohort analytics
4. **Timed Quizzes:** Optional time limits for exam practice
5. **Essay Questions:** Support for free-response with AI grading
6. **Quiz Explanations:** Generate explanations via Claude for custom questions
7. **Quiz Difficulty Calibration:** Auto-adjust IRT parameters based on population performance

---

## Troubleshooting

### No questions appear in quiz
- Ensure `quiz_questions` table is populated
- Run `backend/scripts/seed_quiz_questions.py` to add sample questions
- Check that topic_id (if specified) has associated questions

### Ability estimates seem wrong
- New users start at θ = 0.0 (average)
- Ability updates are conservative to avoid overfitting
- Check `learner_ability_before` and `learner_ability_after` in quiz_responses

### Confidence calibration always "overconfident"
- This is normal behavior — most learners are overconfident
- Feedback helps users recalibrate over multiple quizzes

---

## Code Example: Integrating Quizzes

### In a Learning Path

```tsx
import { QuizModal } from '@/components/Quiz';

export default function LearningPath() {
  const [quizOpen, setQuizOpen] = useState(false);

  return (
    <>
      <VideoPlayer videoId={videoId} />
      
      <Button onClick={() => setQuizOpen(true)}>
        Test Knowledge (2 min)
      </Button>

      <QuizModal
        isOpen={quizOpen}
        onClose={() => setQuizOpen(false)}
        topicId={topicId}
      />
    </>
  );
}
```

### Fetching Quiz Results Programmatically

```typescript
const response = await fetch(`/api/quiz/${sessionId}/results`, {
  headers: { Authorization: `Bearer ${token}` }
});

const results = await response.json();

if (results.performance_level === 'expert') {
  // Unlock advanced course
}
```

---

**NEW-PACKET-C Complete**
