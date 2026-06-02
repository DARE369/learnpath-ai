-- PACKET 6.2 Performance Optimization: Database Indexes
-- Run this migration to add indexes for improved query performance
-- Target: Database queries < 100ms (95th percentile)

-- ==========================================
-- PACKET 6.1 Mobile App Indexes
-- ==========================================

-- User sessions (for offline sync tracking)
CREATE INDEX IF NOT EXISTS idx_path_sessions_user_id
  ON path_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_path_sessions_path_id
  ON path_sessions(path_id);

CREATE INDEX IF NOT EXISTS idx_path_sessions_user_created
  ON path_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_path_sessions_created_at
  ON path_sessions(created_at DESC);

-- ==========================================
-- PACKET 6.2 Performance Optimization Indexes
-- ==========================================

-- User lookups
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_tier
  ON users(tier);

CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_organization_id
  ON users(organization_id);

-- Quiz performance (for analytics)
CREATE INDEX IF NOT EXISTS idx_question_answers_user_id
  ON question_answers(user_id);

CREATE INDEX IF NOT EXISTS idx_question_answers_created_at
  ON question_answers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_answers_user_created
  ON question_answers(user_id, created_at DESC);

-- Learning path sessions
CREATE INDEX IF NOT EXISTS idx_learning_paths_difficulty
  ON learning_paths(difficulty_level);

CREATE INDEX IF NOT EXISTS idx_learning_path_sessions_status
  ON learning_path_sessions(status);

-- ==========================================
-- PACKET 6.5 Customer Success Indexes
-- ==========================================

-- Organization lookups
CREATE INDEX IF NOT EXISTS idx_organizations_admin_id
  ON organizations(admin_id);

CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON organizations(status);

CREATE INDEX IF NOT EXISTS idx_organizations_tier
  ON organizations(tier);

-- Organization subscriptions
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_organization_id
  ON organization_subscriptions(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_tier
  ON organization_subscriptions(tier);

-- Organization payments (for invoice tracking)
CREATE INDEX IF NOT EXISTS idx_org_payments_organization_id
  ON organization_payments(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_payments_status
  ON organization_payments(status);

CREATE INDEX IF NOT EXISTS idx_org_payments_created_at
  ON organization_payments(created_at DESC);

-- School analytics (for performance reporting)
CREATE INDEX IF NOT EXISTS idx_school_analytics_org_id
  ON school_analytics(organization_id);

CREATE INDEX IF NOT EXISTS idx_school_analytics_date
  ON school_analytics(date DESC);

CREATE INDEX IF NOT EXISTS idx_school_analytics_org_date
  ON school_analytics(organization_id, date DESC);

-- ==========================================
-- PACKET 6.3+ Accessibility & B2B Indexes
-- ==========================================

-- B2B: Teacher organization lookup
CREATE INDEX IF NOT EXISTS idx_teachers_organization_id
  ON teachers(organization_id);

CREATE INDEX IF NOT EXISTS idx_teachers_user_id
  ON teachers(user_id);

-- B2B: Class management
CREATE INDEX IF NOT EXISTS idx_classes_organization_id
  ON classes(organization_id);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id
  ON classes(teacher_id);

-- B2B: Class memberships
CREATE INDEX IF NOT EXISTS idx_class_memberships_class_id
  ON class_memberships(class_id);

CREATE INDEX IF NOT EXISTS idx_class_memberships_user_id
  ON class_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_class_memberships_class_user
  ON class_memberships(class_id, user_id);

-- ==========================================
-- Cache & Session Indexes
-- ==========================================

-- Sessions (for auth)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token
  ON user_sessions(token);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
  ON user_sessions(expires_at DESC);

-- Notifications (for customer success)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(created_at DESC);

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
