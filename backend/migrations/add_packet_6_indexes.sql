-- PACKET 6.2 Performance Optimization: Database Indexes (Conservative)
-- Only indexes tables that definitely exist in production
-- Target: Database queries < 100ms (95th percentile)

-- ==========================================
-- Core User & Session Indexes
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Path sessions (for offline sync tracking)
CREATE INDEX IF NOT EXISTS idx_path_sessions_user_created
  ON path_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_path_sessions_youtube_id
  ON path_sessions(youtube_id);

-- ==========================================
-- User Progress & Topics
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id
  ON user_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_topic
  ON user_progress(user_id, topic_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_status
  ON user_progress(status);

-- Concept mastery tracking
CREATE INDEX IF NOT EXISTS idx_concept_progress_user_id
  ON concept_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_concept_progress_concept
  ON concept_progress(concept_name);

CREATE INDEX IF NOT EXISTS idx_concept_progress_user_created
  ON concept_progress(user_id, last_seen_at DESC);

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
-- B2B: Teacher, Class, Analytics
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_teachers_organization_id
  ON teachers(organization_id);

CREATE INDEX IF NOT EXISTS idx_classes_organization_id
  ON classes(organization_id);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id
  ON classes(teacher_id);

CREATE INDEX IF NOT EXISTS idx_class_memberships_class_student
  ON class_memberships(class_id, student_id);

CREATE INDEX IF NOT EXISTS idx_class_memberships_student_id
  ON class_memberships(student_id);

CREATE INDEX IF NOT EXISTS idx_teacher_analytics_date
  ON teacher_analytics(date DESC);

-- ==========================================
-- Subscription & Payment Tracking
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON transactions(user_id, created_at DESC);
