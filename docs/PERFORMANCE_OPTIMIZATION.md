# Performance Optimization (Packet 6.2)

## Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Page load (P95) | <2s | TBD |
| First Contentful Paint | <1.5s | TBD |
| Time to Interactive | <3s | TBD |
| Video buffering | <2s | TBD |
| Quiz load | <1s | TBD |
| API response | <500ms | TBD |
| Database query | <100ms | TBD |

---

## Backend Optimizations

### 1. Caching Layer (Redis)

**Implementation:** `backend/services/cache_manager.py`

```python
# Usage in routes
from services.cache_manager import cache_result, CACHE_TTLS

@router.get("/path/{path_id}")
@cache_result(ttl_seconds=CACHE_TTLS["path_recommendations"])
def get_path(path_id: str, db: Session = Depends(get_db)):
    return path_service.get_path(path_id)
```

**TTL Strategy:**
- User profiles: 30 minutes (changes frequently)
- Quiz questions: 7 days (static content)
- Leaderboard: 1 hour (daily refresh)
- Path recommendations: 24 hours (algorithmic, not real-time)
- Analytics: 5 minutes (business metrics)

### 2. Database Optimization

**Indexing Strategy:**

```sql
-- User queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Session queries
CREATE INDEX idx_path_sessions_user_id ON path_sessions(user_id);
CREATE INDEX idx_path_sessions_path_id ON path_sessions(path_id);
CREATE INDEX idx_path_sessions_created_at ON path_sessions(created_at DESC);

-- Quiz performance
CREATE INDEX idx_question_answers_user_id ON question_answers(user_id);
CREATE INDEX idx_question_answers_created_at ON question_answers(created_at DESC);

-- B2B (Organization queries)
CREATE INDEX idx_organizations_admin_id ON organizations(admin_id);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_teachers_organization_id ON teachers(organization_id);
CREATE INDEX idx_classes_organization_id ON classes(organization_id);
CREATE INDEX idx_class_memberships_class_id ON class_memberships(class_id);
```

**Query Optimization:**

```python
# Bad: N+1 queries
users = db.query(User).all()
for user in users:
    sessions = db.query(PathSession).filter(...).count()  # N queries

# Good: Join
from sqlalchemy import func
result = db.query(
    User,
    func.count(PathSession.id)
).outerjoin(PathSession).group_by(User.id).all()
```

### 3. API Pagination

```python
@router.get("/paths")
def list_paths(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Return 20 items at a time, not all 10,000."""
    return db.query(LearningPath).offset(skip).limit(limit).all()
```

### 4. Lazy Loading

```python
# Videos only load metadata until played
@router.get("/path/{path_id}/summary")
def get_path_summary(path_id: str):
    """Return path with video IDs only, not full video data."""
    return {
        "id": path_id,
        "videos": [
            {"id": vid, "title": "...", "duration": 600}
            # Don't include transcript, captions, etc.
        ]
    }
```

---

## Frontend Optimizations

### 1. Code Splitting

```typescript
// pages/learning/[pathId]/[videoIndex].tsx
const VideoPlayer = dynamic(
  () => import('../../components/VideoPlayer'),
  { loading: () => <Spinner /> }
);

// Only loaded when route is accessed
```

### 2. Image Optimization

- Use WebP format (fallback to JPEG)
- Responsive sizes: srcset="small.jpg 480w, medium.jpg 1024w, large.jpg 1920w"
- Lazy load: loading="lazy"

### 3. CSS & JS Optimization

- Minification: Next.js handles automatically
- Tree-shaking: Remove unused code
- Preload critical resources: `<link rel="preload" href="...">`

### 4. Service Worker Caching

```typescript
// service-worker.ts
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('v1').then(cache => {
      return cache.addAll([
        '/',
        '/dashboard',
        '/learning',
      ]);
    })
  );
});
```

---

## Monitoring & Alerting

### Sentry (Error Tracking)

```python
# main.py
import sentry_sdk
sentry_sdk.init(dsn=settings.SENTRY_DSN)

# Errors automatically captured
```

### DataDog (APM)

```python
from services.performance_monitor import metrics, track_performance

@track_performance("video_encoding")
def encode_video(video_id: str):
    # Execution time tracked automatically
    pass

# View metrics in DataDog dashboard
```

### Custom Metrics

```python
from services.performance_monitor import metrics

# Record custom metric
metrics.record_metric(
    "api.quiz_submitted",
    1,  # Count
    {"course": "biology"}
)

# Get statistics
stats = metrics.get_stats("api.quiz_submitted")
# {"min": 1, "max": 1, "avg": 1.0, "count": 5}
```

### Health Checks

```
GET /health                 # Overall health
GET /db-health              # Database connection + API reachability
```

---

## Performance Testing

### Lighthouse CI

```bash
# Automated performance testing on PR
npm run lighthouse:ci
```

**Target scores:**
- Performance: 85+
- Best Practices: 90+
- SEO: 100

### Load Testing

```bash
# Simulate 100 concurrent users
k6 run load-test.js --vus 100 --duration 30s
```

---

## Deployment Checklist

- [ ] Redis configured and reachable
- [ ] Database indexes created
- [ ] Sentry DSN configured
- [ ] DataDog API key configured
- [ ] CDN configured for static assets
- [ ] Service worker deployed
- [ ] Lighthouse score 85+
- [ ] API response times <500ms (P95)
- [ ] Zero N+1 queries in logs
- [ ] Cache invalidation strategy documented

---

## Monitoring Dashboard

**Key metrics to watch:**

1. **API Response Times** - alert if P95 > 500ms
2. **Error Rate** - alert if > 1%
3. **Database Query Times** - alert if max > 500ms
4. **Cache Hit Rate** - target 80%+
5. **User Sessions** - DAU/MAU trends
6. **Video Playback** - buffer rate, bitrate

**Alert channels:** Slack #alerts
