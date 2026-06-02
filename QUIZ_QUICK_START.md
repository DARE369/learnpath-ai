# Quiz System Quick Start Guide

## 🚀 Getting Started

### Step 1: Create Quiz Tables (One-time Setup)

Run the SQL migration to create all quiz tables:

```bash
# Using psql directly
psql -d postgres://...your-database-url... -f backend/migrations/add_quiz_tables.sql

# Or using the Railway CLI
railway database psql < backend/migrations/add_quiz_tables.sql
```

Verify tables were created:
```bash
psql -d postgres://...your-database-url...
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

You should see:
- quiz_sessions
- quiz_questions
- quiz_responses
- concept_mastery
- fsrs_cards

### Step 2: Seed Sample Questions

```bash
cd backend
python scripts/seed_quiz_questions.py
```

Output:
```
Quiz questions seeded successfully!
Added 8 sample quiz questions
```

Verify questions were added:
```bash
psql -d postgres://...your-database-url...
SELECT COUNT(*) FROM quiz_questions;
```

Should return: `8`

### Step 3: Run Unit Tests

```bash
cd backend
pytest tests/test_quiz_engine.py -v
```

Expected output:
```
test_start_quiz_session PASSED
test_irt_probability_calculation PASSED
test_ability_update_correct PASSED
test_ability_update_incorrect PASSED
test_confidence_calibration_* PASSED (3 tests)
test_submit_answer PASSED
test_complete_quiz_session PASSED

========== 13 passed ==========
```

---

## 🧪 Testing the API

### Option A: Using curl

#### 1. Get Auth Token

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "your_password"
  }'

# Save the access_token from response
export TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

#### 2. Start a Quiz

```bash
curl -X POST http://localhost:8000/api/quiz/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Response:
# {
#   "session_id": "123e4567-e89b-12d3-a456-426614174000",
#   "question": {
#     "id": "...",
#     "text": "What is the capital of France?",
#     "type": "multiple_choice",
#     "options": [
#       {"text": "Paris", "id": "A"},
#       {"text": "London", "id": "B"}
#     ]
#   },
#   "question_number": 1,
#   "total_questions": 5
# }
```

Save `session_id` for next step.

#### 3. Submit an Answer

```bash
export SESSION_ID="123e4567-e89b-12d3-a456-426614174000"

curl -X POST http://localhost:8000/api/quiz/$SESSION_ID/answer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question_id": "87654321-e89b-12d3-a456-426614174000",
    "answer": "A",
    "confidence": 7,
    "time_spent": 30
  }'

# Response:
# {
#   "is_correct": true,
#   "explanation": "Paris is the capital of France.",
#   "confidence_feedback": "Well-calibrated! ✓",
#   "ability_updated": 0.25,
#   "next_question": { ... },
#   "question_number": 2
# }
```

#### 4. Get Quiz Results

After completing all questions:

```bash
curl -X GET http://localhost:8000/api/quiz/$SESSION_ID/results \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "id": "123e4567-e89b-12d3-a456-426614174000",
#   "score": 80,
#   "level": "above_average",
#   "recommendation": "Excellent work!...",
#   "weak_concepts": ["concept_x"],
#   "strong_concepts": ["concept_y"],
#   "total_time_seconds": 180,
#   "completed_at": "2026-06-02T15:30:00"
# }
```

---

### Option B: Using Postman

1. **Create a new Postman collection** called "LearnPath AI Quiz"

2. **Set environment variables:**
   - `base_url` = `http://localhost:8000`
   - `token` = `<your_auth_token>`
   - `session_id` = (set after start quiz)
   - `question_id` = (set after start quiz)

3. **Create requests:**

   **Request 1: Login**
   ```
   POST {{base_url}}/api/auth/login
   Body: {
     "email": "test@example.com",
     "password": "password"
   }
   Tests: pm.environment.set("token", pm.response.json().access_token);
   ```

   **Request 2: Start Quiz**
   ```
   POST {{base_url}}/api/quiz/start
   Headers: Authorization: Bearer {{token}}
   Tests: 
     pm.environment.set("session_id", pm.response.json().session_id);
     pm.environment.set("question_id", pm.response.json().question.id);
   ```

   **Request 3: Submit Answer**
   ```
   POST {{base_url}}/api/quiz/{{session_id}}/answer
   Headers: Authorization: Bearer {{token}}
   Body: {
     "question_id": "{{question_id}}",
     "answer": "A",
     "confidence": 7,
     "time_spent": 30
   }
   ```

   **Request 4: Get Results**
   ```
   GET {{base_url}}/api/quiz/{{session_id}}/results
   Headers: Authorization: Bearer {{token}}
   ```

---

## 🎨 Testing the Frontend

### Option A: Local Dev Server

1. **Start backend:**
   ```bash
   cd backend
   python -m uvicorn main:app --reload
   ```

2. **Start frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **In browser:**
   - Go to http://localhost:3000/dashboard
   - Log in with test account
   - Click "🎯 Take a Quick Quiz" button
   - Answer 5 questions
   - View results

### Option B: Test in Deployed App

If backend and frontend are deployed:
1. Go to https://learnpath-ai-eight.vercel.app/dashboard
2. Log in
3. Click quiz button
4. Test full flow

---

## 📊 Monitoring Quiz Activity

### Check Quiz Sessions

```bash
psql -d postgres://...database-url...

SELECT 
  id, 
  user_id, 
  quiz_type, 
  score_percent, 
  performance_level,
  created_at
FROM quiz_sessions
ORDER BY created_at DESC
LIMIT 10;
```

### Check Quiz Responses

```bash
SELECT 
  r.id,
  r.user_id,
  r.is_correct,
  r.confidence_rating,
  r.confidence_appropriate,
  r.learner_ability_before,
  r.learner_ability_after
FROM quiz_responses r
ORDER BY r.created_at DESC
LIMIT 20;
```

### Check Concept Mastery

```bash
SELECT 
  user_id,
  concept_id,
  accuracy_percent,
  is_mastered,
  questions_attempted
FROM concept_mastery
WHERE accuracy_percent > 0
ORDER BY accuracy_percent DESC;
```

---

## 🐛 Troubleshooting

### Issue: "No questions available for this quiz"

**Solution:**
1. Check if quiz_questions table is empty:
   ```bash
   psql -d postgres://...database-url...
   SELECT COUNT(*) FROM quiz_questions;
   ```

2. If empty, run seed script:
   ```bash
   python backend/scripts/seed_quiz_questions.py
   ```

### Issue: "Quiz session not found"

**Solution:**
- Ensure you're passing the correct session_id
- Session IDs are UUIDs (long hexadecimal strings)
- Copy from API response, don't type manually

### Issue: "Unauthorized" error

**Solution:**
- Make sure you have a valid auth token
- Token should start with "Bearer eyJ..."
- Tokens expire after 24 hours
- Get a new token with login endpoint

### Issue: "Internal server error" (500)

**Solution:**
1. Check backend logs:
   ```bash
   cd backend
   python -m uvicorn main:app --reload
   # Look for error messages
   ```

2. Common causes:
   - Missing quiz_questions table (run migration)
   - topic_id doesn't exist (use NULL or valid UUID)
   - Database connection issue (check DATABASE_URL env var)

---

## 📈 Example Quiz Flow

Here's what a complete quiz session looks like:

### Question 1: Easy question (difficulty = -1.0)
- P(correct) ≈ 73% before attempt
- User answers correctly
- Ability updates: 0.0 → +0.15

### Question 2: Slightly harder (difficulty = +0.5)
- P(correct) ≈ 64% (using new ability)
- User answers correctly
- Ability updates: +0.15 → +0.28

### Question 3: Medium difficulty (difficulty = +1.5)
- P(correct) ≈ 58%
- User answers incorrectly
- Ability updates: +0.28 → +0.22

### Question 4: Back to medium (difficulty = +0.8)
- P(correct) ≈ 62% (with updated ability)
- User answers correctly
- Ability updates: +0.22 → +0.30

### Question 5: Final question (difficulty = adaptive)
- System targets P(correct) ≈ 65%
- User answers correctly
- Ability updates: +0.30 → +0.35

**Results:**
- Score: 4/5 = 80%
- Performance: above_average
- Final ability: +0.35 (learner is above average)
- Recommendation: "Excellent work! Keep reinforcing weak areas"

---

## 🎯 Next Steps

After successful testing:

1. **Deploy to Production:**
   - Run migration on production database
   - Seed production questions (or create via admin UI)
   - Monitor quiz endpoints

2. **Gather User Feedback:**
   - Are questions appropriately difficult?
   - Is feedback helpful?
   - Any UI/UX improvements needed?

3. **Iterate:**
   - Adjust IRT parameters based on data
   - Add more questions
   - Implement advanced features (FSRS, retakes, etc.)

---

## 📚 Additional Resources

- Complete API docs: [backend/docs/QUIZ_SYSTEM.md](backend/docs/QUIZ_SYSTEM.md)
- Implementation details: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- Unit tests: [backend/tests/test_quiz_engine.py](backend/tests/test_quiz_engine.py)
- Sample questions: [backend/scripts/seed_quiz_questions.py](backend/scripts/seed_quiz_questions.py)

---

Happy quizzing! 🎓
