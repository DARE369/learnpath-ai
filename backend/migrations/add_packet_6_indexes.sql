-- PACKET 6.2 Performance Optimization: Database Indexes
-- Run this migration to add indexes for improved query performance
-- Target: Database queries < 100ms (95th percentile)

-- ==========================================
-- PACKET 6.1 Mobile App Indexes
-- ==========================================

-- Path sessions (for offline sync tracking)
CREATE INDEX IF NOT EXISTS idx_path_sessions_user_created
  ON path_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_path_sessions_youtube_id
  ON path_sessions(youtube_id);

-- Quiz/assessment sessions
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id
  ON quiz_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_created
  ON quiz_sessions(user_id, created_at DESC);

-- Quiz responses (for progress tracking)
CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_id
  ON quiz_responses(user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_responses_created_at
  ON quiz_responses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_created
  ON quiz_responses(user_id, created_at DESC);

-- ==========================================
-- PACKET 6.2 Performance Optimization Indexes
-- ==========================================

-- User lookups
CREATE INDEX IF NOT EXISTS idx_users_tier
  ON users(tier);

CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users(created_at DESC);

-- Topics & concepts
CREATE INDEX IF NOT EXISTS idx_concept_progress_user_created
  ON concept_progress(user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_concept_mastery_user_id
  ON concept_mastery(user_id);

-- Search events (for popular topic identification)
CREATE INDEX IF NOT EXISTS idx_search_events_user_created
  ON search_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_events_normalized_created
  ON search_events(query_normalized, created_at DESC);

-- ==========================================
-- PACKET 6.5 Customer Success Indexes
-- ==========================================

-- Organization lookups
CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON organizations(status);

CREATE INDEX IF NOT EXISTS idx_organizations_subscription_tier
  ON organizations(subscription_tier);

CREATE INDEX IF NOT EXISTS idx_organizations_created_at
  ON organizations(created_at DESC);

-- Organization subscriptions
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_tier
  ON organization_subscriptions(tier);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status
  ON organization_subscriptions(status);

-- Organization payments (for invoice tracking)
CREATE INDEX IF NOT EXISTS idx_org_payments_status
  ON organization_payments(status);

CREATE INDEX IF NOT EXISTS idx_org_payments_created_at
  ON organization_payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_payments_org_status
  ON organization_payments(organization_id, status);

-- School analytics (for performance reporting)
CREATE INDEX IF NOT EXISTS idx_school_analytics_org_date
  ON school_analytics(organization_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_school_analytics_date
  ON school_analytics(date DESC);

-- ==========================================
-- PACKET 6.3+ Accessibility & B2B Indexes
-- ==========================================

-- B2B: Teacher organization lookup
CREATE INDEX IF NOT EXISTS idx_teachers_organization_id
  ON teachers(organization_id);

-- B2B: Class management
CREATE INDEX IF NOT EXISTS idx_classes_organization_id
  ON classes(organization_id);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id
  ON classes(teacher_id);

-- B2B: Class memberships
CREATE INDEX IF NOT EXISTS idx_class_memberships_class_student
  ON class_memberships(class_id, student_id);

CREATE INDEX IF NOT EXISTS idx_class_memberships_student_id
  ON class_memberships(student_id);

-- Teacher analytics
CREATE INDEX IF NOT EXISTS idx_teacher_analytics_date
  ON teacher_analytics(date DESC);

-- ==========================================
-- Performance Verification Queries
-- ==========================================

-- After running this migration, verify indexes with:
-- SELECT * FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- Check index usage with:
-- SELECT schemaname, tablename, indexname, idx_scan
-- FROM pg_stat_user_indexes
-- WHERE idx_scan > 0
-- ORDER BY idx_scan DESC;

-- Monitor slow queries:
-- SET log_min_duration_statement = 100;  -- Log queries > 100ms
