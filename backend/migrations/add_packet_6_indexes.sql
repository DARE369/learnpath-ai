-- PACKET 6.2 Performance Optimization: Database Indexes
-- Only core tables confirmed to exist
-- Target: Database queries < 100ms (95th percentile)

-- Core User & Session Indexes
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_path_sessions_user_created
  ON path_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_path_sessions_youtube_id
  ON path_sessions(youtube_id);

-- User Progress & Learning
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

CREATE INDEX IF NOT EXISTS idx_concept_progress_user_created
  ON concept_progress(user_id, last_seen_at DESC);
