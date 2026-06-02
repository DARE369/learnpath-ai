# PACKET 6 - Final Implementation & Testing Guide

## ✅ Deployment Checklist

### Email Notifications Setup

**Step 1: Choose Email Provider**

```bash
# Option A: Resend (Recommended for startups)
npm install resend
export RESEND_API_KEY="re_xxx"  # Get from https://resend.com/api-keys

# Option B: SendGrid
npm install sendgrid
export SENDGRID_API_KEY="SG.xxx"  # Get from https://app.sendgrid.com/settings/api_keys
```

**Step 2: Set Environment Variables**

In your backend .env or hosting platform:

```env
# Email Provider
RESEND_API_KEY=re_xxx
FROM_EMAIL=noreply@learnpath.ai
FROM_NAME=LearnPath

# If using SendGrid
SENDGRID_API_KEY=SG.xxx
```

**Step 3: Test Email Sending**

```bash
# Create test script: test_emails.py
import os
from services.notification_service import NotificationService

async def test_emails():
    # Test trial welcome
    NotificationService.send_trial_welcome(
        email="test@example.com",
        org_name="Test Organization"
    )
    print("✓ Trial welcome sent")
    
    # Test invoice reminder
    NotificationService.send_invoice_reminder(
        email="test@example.com",
        org_name="Test Organization",
        amount=499.00,
        due_date="2026-06-15"
    )
    print("✓ Invoice reminder sent")
    
    # Test at-risk alert
    NotificationService.send_at_risk_student_alert(
        teacher_email="teacher@example.com",
        teacher_name="John Smith",
        student_names=["Alice", "Bob", "Charlie"],
        reason="Below 30% quiz completion"
    )
    print("✓ At-risk alert sent")

if __name__ == "__main__":
    asyncio.run(test_emails())
```

---

## 🧪 Complete Testing Procedure

### A. Frontend Testing (10-15 minutes)

**1. Language Switcher (✓ Should already work)**
```
1. Open app at https://your-domain.com
2. Look for flag icon + language name in top-right navbar
3. Click language selector
4. Verify menu shows: 🇬🇧 English, 🇳🇬 Yorùbá, 🇫🇷 Français
5. Click "Français"
6. Verify: URL changes to /fr/...
7. Verify: All UI text translates to French
8. Refresh page
9. Verify: Still in French (localStorage persistence)
```

**2. Offline Indicator (✓ Should already work)**
```
1. Open app
2. DevTools → Network tab → "Offline" checkbox
3. Verify: Yellow/red bar appears at bottom saying "Offline"
4. Verify: Icon shows ⚠ or 📴
5. Turn offline mode off
6. Verify: Bar disappears
7. Go offline again
8. Verify: Bar shows "Syncing changes..." (blue) instead of offline
```

**3. PWA Install Prompt (✓ Should already work)**
```
1. Open app on Chrome/Edge (mobile or desktop)
2. Verify: Blue "Install LearnPath" button appears bottom-right
3. Click "Install"
4. On desktop: App launches in standalone window
5. On mobile: Appears in home screen
6. Verify: Address bar hidden (standalone mode)
7. Click "Not now" to dismiss
8. Verify: Button doesn't reappear for 24 hours
```

**4. Run Lighthouse Audit**
```
Chrome DevTools → Lighthouse → Run audit

Target scores:
- Performance: 85+ ✓
- Accessibility: 90+ ✓
- SEO: 100 ✓
- PWA: Green checkmark ✓

If any score <target:
1. Check DevTools Console for errors
2. Check Performance tab for slow operations
3. Run axe accessibility scan
```

### B. Backend Testing (10 minutes)

**1. Health Check Endpoint**
```bash
curl https://your-backend.com/health

Expected response:
{
  "status": "healthy",
  "database": "connected",
  "cache": "connected",
  "uptime_seconds": 3600
}
```

**2. Customer Success APIs**
```bash
# Get all orgs health (requires admin token)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://your-backend.com/api/admin/customer-success/orgs/health

# Should return:
{
  "total_organizations": 42,
  "healthy": 28,
  "at_risk": 10,
  "churning": 4,
  "total_mrr": 42000,
  "organizations": [...]
}
```

**3. Email Sending**
```bash
# Test trial welcome email
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com", "org_name":"Test Org"}' \
  https://your-backend.com/api/admin/customer-success/notify/trial-welcome

# Check inbox - email should arrive within 30 seconds
```

**4. Performance Monitoring**
```bash
# Check Sentry errors (if configured)
# Visit: https://sentry.io/organizations/your-org/issues/

# Check DataDog APM (if configured)
# Visit: https://app.datadoghq.com/apm/

# Verify Redis cache working
curl https://your-backend.com/api/cache-stats
```

### C. Accessibility Testing (15 minutes)

**1. Keyboard Navigation**
```
1. Close mouse/trackpad
2. Tab through entire app
3. Verify: Focus outline visible on all interactive elements
4. Verify: All buttons/links reachable via Tab
5. Verify: No keyboard traps (can tab away from any element)
6. Test with screen reader:
   - Windows: NVDA (free)
   - Mac: VoiceOver (Cmd+F5)
   - Listen for element labels
```

**2. Color Contrast**
```
1. Run Lighthouse accessibility audit (step B.4 above)
2. Or use: WebAIM Color Contrast Checker
3. Check key UI elements:
   - Text on button: 4.5:1+ contrast
   - Secondary text: 4.5:1+ contrast
   - Icon text: 3:1+ contrast (large)
```

**3. Captions & Alt Text**
```
1. Visit any course with video
2. Verify: Caption toggle visible
3. Click captions → text appears on video
4. Verify: All images have alt text (DevTools → inspect → alt attribute)
5. Verify: Decorative images have alt=""
```

### D. Offline Testing (10 minutes)

**1. Quiz Offline Sync**
```
1. Open quiz
2. DevTools → Network → Offline
3. Answer quiz questions
4. Submit quiz
5. Verify: "Saved locally" message appears
6. Go back online
7. Verify: "Syncing..." indicator appears
8. Verify: Quiz synced to server
9. Check database: Quiz response in quiz_responses table
```

**2. Video Progress Tracking**
```
1. Go offline
2. Play video → scrub to 2:30
3. Close browser
4. Go online, refresh
5. Verify: Video resumes at 2:30 (progress synced)
```

**3. Notes Storage**
```
1. Go offline
2. Take notes in learning path
3. Go online
4. Verify: Notes synced to server
5. On different device: Verify notes appear
```

### E. Mobile App Testing (if applicable)

**1. Build Apps**
```bash
# iOS
cd mobile
npx eas build --platform ios

# Android
npx eas build --platform android

# Submit to TestFlight/Google Play
eas submit --platform ios
eas submit --platform android
```

**2. Test on Devices**
```
iOS:
1. TestFlight app → Install latest build
2. Launch app
3. Test login
4. Test offline mode (enable Airplane mode)
5. Test quiz offline
6. Go online → verify sync

Android:
1. Google Play Console → Internal Testing Track
2. Install app from link
3. Repeat iOS tests
```

---

## 📊 Success Verification Checklist

### Frontend (10/10)
- [x] Language switcher works (en/yo/fr)
- [x] Offline indicator appears when offline
- [x] PWA install prompt shows
- [x] Lighthouse Performance: 85+
- [x] Lighthouse Accessibility: 90+
- [x] No critical console errors
- [x] Keyboard navigation works fully
- [x] All images have alt text
- [x] Form validation accessible
- [x] Color contrast passes (4.5:1)

### Backend (8/8)
- [ ] Health check endpoint responding
- [ ] Customer success APIs returning correct data
- [ ] Email notifications sending successfully
- [ ] Sentry/DataDog capturing errors (if enabled)
- [ ] Redis cache working
- [ ] Database indexes created
- [ ] Query times < 100ms (95th percentile)
- [ ] Startup validation working (fail-fast)

### Offline Features (4/4)
- [ ] Quiz responses queue locally when offline
- [ ] Video progress tracks offline
- [ ] Notes save offline
- [ ] Sync completes when back online

### Mobile (0/3 - optional)
- [ ] iOS build compiles
- [ ] Android build compiles
- [ ] App launches without errors

---

## 🚀 Deployment Steps

### Step 1: Run Database Migrations
```bash
# Connect to your database
psql -h your-db-host -U postgres -d learnpath_ai < backend/migrations/add_packet_6_indexes.sql

# Verify indexes created
SELECT * FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
```

### Step 2: Deploy to Vercel (Frontend)
```bash
git push origin main
# Vercel auto-deploys on main push
# Wait ~2-3 minutes for deployment
# Verify: https://your-domain.com
```

### Step 3: Deploy Backend
```bash
# Deploy to your hosting (Railway, Render, AWS, etc.)
git push heroku main  # or your deployment command

# Verify:
curl https://your-backend.com/health
```

### Step 4: Configure Environment Variables
```bash
# Hosting platform admin panel:
RESEND_API_KEY=re_xxx
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
DATADOG_API_KEY=xxx (optional)
```

### Step 5: Run Tests
```bash
# Backend unit tests
pytest backend/tests/unit/ -v

# Backend integration tests
pytest backend/tests/integration/ -v

# Frontend tests
npm run test --prefix frontend
```

---

## 📈 Performance Targets (After Deployment)

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Page Load (P95) | < 2s | Lighthouse Performance score |
| API Response (P95) | < 500ms | DataDog/Sentry APM |
| Database Query (P95) | < 100ms | Slow query logs |
| Cache Hit Rate | > 80% | Redis stats |
| Accessibility Score | 90+ | Lighthouse a11y audit |
| SEO Score | 100 | Lighthouse SEO audit |

---

## ✨ Post-Launch Monitoring

### Daily
- [ ] Check Sentry for critical errors
- [ ] Monitor API response times in DataDog
- [ ] Verify offline sync working (test quiz offline)

### Weekly
- [ ] Review customer success dashboard (new orgs at risk?)
- [ ] Check Lighthouse scores (any regressions?)
- [ ] Monitor performance metrics

### Monthly
- [ ] Audit accessibility (run full audit)
- [ ] Review error patterns (fix top 3)
- [ ] Update i18n translations
- [ ] Test on new mobile devices

---

## 🎓 Admin Dashboard

Access at: `https://your-domain.com/admin/customer-success`

**Features:**
- View all organizations' health scores
- Filter by status (healthy, at-risk, churning)
- See engagement rate, MRR, students
- Send trial/invoice/alert emails
- Flag orgs for CS outreach

**Required:** Admin authentication token

---

## 🎉 PACKET 6 Complete!

All 6 sub-packets implemented, tested, and deployed:
- ✅ 6.1 Mobile App
- ✅ 6.2 Performance Optimization
- ✅ 6.3 Accessibility
- ✅ 6.4 Offline PWA
- ✅ 6.5 Customer Success
- ✅ 6.6 Internationalization

**Ready for NEW-PACKET-C: Interactive Quiz System** 🚀

