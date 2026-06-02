-- PACKET 6.2 Performance Optimization: Database Indexes (Minimal)
-- Only indexes CORE tables from Packets 1-4 that definitely exist
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
-- User Progress & Topics (Core Learning)
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id
  ON user_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_topic
  ON user_progress(user_id, topic_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_status
  ON user_progress(status);

CREATE INDEX IF NOT EXISTS idx_concept_progress_user_id
  ON concept_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_concept_progress_concept
  ON concept_progress(concept_name);

-- ==========================================
-- Monetization (Packets 4.1 - 4.6)
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions(status);

CREATE INDEX IF NOT EXISTS idx_billing_history_user_created
  ON billing_history(user_id, created_at DESC);

-- Referrals
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id
  ON referrals(referrer_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referral_code_id
  ON referrals(referral_code_id);

-- ==========================================
-- Note: B2B tables (organizations, teachers, classes, school_analytics)
-- will be indexed after their schema is created in production
-- ==========================================
