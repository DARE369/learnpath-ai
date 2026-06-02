# NEW-PACKET-C Deployment Instructions

## Overview

NEW-PACKET-C (Interactive Quiz System with Adaptive Difficulty) is fully implemented and ready for deployment. It integrates seamlessly with the existing system without breaking any existing features.

## Pre-Deployment Checklist

- [ ] All files committed to git
- [ ] Code review completed
- [ ] Unit tests passing locally
- [ ] Database migration tested on staging
- [ ] Sample questions seeded and verified
- [ ] Frontend components tested in dev environment
- [ ] API endpoints tested with curl/Postman
- [ ] Dashboard quiz button tested

---

## Deployment Steps

### Phase 1: Database (30 minutes)

**On your local machine:**

1. Verify the migration script:
   ```bash
   cat backend/migrations/add_quiz_tables.sql
   # Review the SQL and make sure it looks correct
   ```

2. Create a backup of production database:
   ```bash
   pg_dump $DATABASE_URL > quiz_backup.sql
   ```

3. Run the migration:
   ```bash
   psql $DATABASE_URL -f backend/migrations/add_quiz_tables.sql
   ```

4. Verify tables were created:
   ```bash
   psql $DATABASE_URL -c "\dt quiz_*"
   ```

5. Seed sample questions:
   ```bash
   # You can either:
   # A) Run the Python script (requires Python 3.11 + dependencies)
   python backend/scripts/seed_quiz_questions.py
   
   # B) Or manually insert via SQL:
   psql $DATABASE_URL -f backend/scripts/seed_quiz_questions.sql
   ```

6. Verify data:
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM quiz_questions;"
   # Should return: 8
   ```

### Phase 2: Backend (15 minutes)

1. **Commit all backend changes:**
   ```bash
   git add backend/
   git commit -m "feat(quiz): Add NEW-PACKET-C quiz system with IRT adaptive difficulty"
   ```

2. **Push to main:**
   ```bash
   git push origin main
   ```

3. **Railway auto-deploys** (watch the deployment):
   - Go to https://railway.app
   - Watch the deploy process
   - Wait for "Deployment Successful"

4. **Test backend on production:**
   ```bash
   # Get a fresh auth token
   curl -X POST https://backend-domain.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password"}'
   
   # Test quiz endpoint
   curl -X POST https://backend-domain.railway.app/api/quiz/start \
     -H "Authorization: Bearer $TOKEN"
   ```

### Phase 3: Frontend (10 minutes)

1. **Commit all frontend changes:**
   ```bash
   git add frontend/
   git commit -m "feat(quiz): Add quiz modal and dashboard integration"
   ```

2. **Push to main:**
   ```bash
   git push origin main
   ```

3. **Vercel auto-deploys:**
   - Go to https://vercel.com
   - Watch the deployment
   - Wait for "Ready"

4. **Test frontend in production:**
   - Go to https://learnpath-ai-eight.vercel.app/dashboard
   - Log in
   - Click "🎯 Take a Quick Quiz"
   - Complete a quiz
   - Verify results screen

### Phase 4: Monitoring (5 minutes)

1. **Check error tracking:**
   - Look at your error tracking (Sentry, CloudWatch, etc.)
   - Verify no new errors in quiz endpoints

2. **Monitor database performance:**
   ```bash
   psql $DATABASE_URL -c "\d+ quiz_sessions"
   # Verify indexes are created
   ```

3. **Set up alerts** (optional):
   - Alert if quiz/start endpoint response time > 1s
   - Alert if quiz/answer endpoint response time > 500ms
   - Alert if error rate > 5%

---

## Rollback Plan

If something goes wrong:

### Option 1: Quick Rollback (if no data corruption)

```bash
# Revert database changes
psql $DATABASE_URL -f quiz_backup.sql

# Revert code to previous commit
git revert HEAD
git push origin main
```

### Option 2: Full Rollback

```bash
# Delete quiz tables (removes all quiz data)
psql $DATABASE_URL << EOF
DROP TABLE IF EXISTS fsrs_cards;
DROP TABLE IF EXISTS concept_mastery;
DROP TABLE IF EXISTS quiz_responses;
DROP TABLE IF EXISTS quiz_questions;
DROP TABLE IF EXISTS quiz_sessions;
EOF

# Revert code
git revert HEAD
git push origin main
```

### Option 3: Contact Support

If you need help rolling back, contact:
- Railway support: https://railway.app/support
- Vercel support: https://vercel.com/support

---

## Post-Deployment Validation

### Backend Validation

```bash
# 1. Check that quiz endpoints are accessible
curl -X POST https://your-backend-url/api/quiz/start \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"
# Expected: 200 or 400 (if no questions exist)

# 2. Check database connectivity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM quiz_sessions;"
# Expected: 0 (no sessions yet)

# 3. Check question count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM quiz_questions;"
# Expected: 8 (seeded questions)
```

### Frontend Validation

```bash
# 1. Open browser dev tools
# 2. Go to https://your-frontend-url/dashboard
# 3. Check console for errors
# 4. Click "Take a Quick Quiz" button
# 5. Verify:
#    - Modal opens
#    - Question displays
#    - Options are clickable
#    - Confidence slider works
#    - Submit button works
# 6. Answer all questions
# 7. Verify results screen shows:
#    - Score percentage
#    - Performance level
#    - Weak/strong concepts
#    - Next action buttons
```

---

## Performance Baselines

After deployment, you should see:

| Metric | Target | Acceptable |
|--------|--------|-----------|
| POST /quiz/start | <500ms | <1000ms |
| POST /quiz/{id}/answer | <200ms | <500ms |
| GET /quiz/{id}/results | <100ms | <300ms |
| API error rate | <1% | <5% |
| Database query time | <50ms | <200ms |

Monitor these with your APM tool (DataDog, New Relic, etc.)

---

## Monitoring Dashboard Setup

### Recommended Metrics to Track

1. **Quiz Engagement:**
   - Quizzes started per day
   - Quizzes completed per day
   - Completion rate (completed / started)

2. **Performance:**
   - Average quiz score
   - Average quiz duration
   - Score distribution

3. **System Health:**
   - API response times
   - Error rates
   - Database query times
   - Table sizes

4. **User Behavior:**
   - Users who took quiz
   - Repeat quiz takers
   - Most common weak concepts

### Example Query for Dashboard

```sql
SELECT 
  COUNT(*) as quizzes_started,
  SUM(CASE WHEN session_completed_at IS NOT NULL THEN 1 ELSE 0 END) as quizzes_completed,
  AVG(score_percent) as avg_score,
  AVG(total_time_seconds) as avg_duration
FROM quiz_sessions
WHERE created_at >= NOW() - INTERVAL '1 day';
```

---

## Common Issues & Solutions

### Issue: "No such table: quiz_sessions"

**Cause:** Migration didn't run or failed

**Solution:**
```bash
# Check if tables exist
psql $DATABASE_URL -c "\dt quiz_*"

# If not, run migration again
psql $DATABASE_URL -f backend/migrations/add_quiz_tables.sql

# Verify with:
psql $DATABASE_URL -c "SELECT COUNT(*) FROM quiz_questions;"
```

### Issue: Questions don't appear in quiz

**Cause:** Sample data not seeded

**Solution:**
```bash
# Check if questions exist
psql $DATABASE_URL -c "SELECT COUNT(*) FROM quiz_questions;"

# If 0, seed them
python backend/scripts/seed_quiz_questions.py

# Or create them manually via API (future enhancement)
```

### Issue: "Unauthorized" errors on quiz endpoints

**Cause:** Auth token invalid or expired

**Solution:**
```bash
# Users need to log in first
# Verify auth endpoint is working:
curl -X POST https://your-backend-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

### Issue: Quiz button missing from dashboard

**Cause:** Frontend not deployed

**Solution:**
```bash
# Verify frontend was deployed
# Check git log for recent commits
git log --oneline | head -5

# Force redeploy from Vercel dashboard if needed
```

---

## Gradual Rollout (Optional)

Instead of deploying to all users at once:

### Canary Deployment

1. Deploy to 10% of users
2. Monitor errors and feedback for 24 hours
3. If OK, deploy to 50% of users
4. Monitor for 24 hours
5. Deploy to 100%

This requires feature flags in the frontend (not currently implemented).

### Beta Access

1. Create a `?quiz=beta` query parameter
2. Show quiz button only for beta testers
3. Gather feedback
4. Roll out to all users

---

## Support & Documentation

### For Users
- Share QUIZ_QUICK_START.md with QA/support team
- Share dashboard quiz button tutorial

### For Developers
- Share IMPLEMENTATION_SUMMARY.md with team
- Share QUIZ_SYSTEM.md (complete API docs)
- Share test file: backend/tests/test_quiz_engine.py

### Handoff Checklist
- [ ] Team briefing on IRT algorithm
- [ ] Demo of quiz flow
- [ ] API documentation reviewed
- [ ] Support team trained on common issues
- [ ] Monitoring dashboard set up
- [ ] Runbooks for common problems created

---

## Timeline

**Total deployment time: ~60 minutes**

- Database migration: 5-10 min
- Backend deployment: 5-15 min  
- Frontend deployment: 5-10 min
- Testing & validation: 10-20 min
- Monitoring setup: 10-15 min

---

## Sign-Off Checklist

Before marking deployment complete:

- [ ] Database tables created and verified
- [ ] Sample questions seeded and verified
- [ ] Backend API endpoints working (curl tests pass)
- [ ] Frontend quiz button working
- [ ] Dashboard quiz modal opens and functions
- [ ] Full quiz flow works (start → answers → results)
- [ ] No errors in production logs
- [ ] Monitoring dashboards set up
- [ ] Team trained on system
- [ ] Documentation shared
- [ ] Rollback plan documented
- [ ] Performance baselines established

---

## What To Do Next

1. **Week 1:** Monitor quiz usage and collect feedback
2. **Week 2:** Analyze quiz data for patterns
3. **Week 3:** Create teacher quiz management UI (future)
4. **Week 4:** Implement FSRS spaced repetition (future)

---

## Contact & Support

For questions or issues during deployment:

- **Backend issues:** Check backend logs, run test script
- **Frontend issues:** Check browser console, Vercel logs
- **Database issues:** Check PostgreSQL logs, run verification queries
- **General help:** Refer to QUIZ_SYSTEM.md documentation

---

**Deployment ready! Good luck! 🚀**
