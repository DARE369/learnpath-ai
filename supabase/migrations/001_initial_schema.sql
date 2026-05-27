-- LearnPath AI Initial Schema
-- Migration: 001_initial_schema.sql
-- Stage: 0 Foundation

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    country TEXT,
    age INTEGER,
    email_verified BOOLEAN DEFAULT FALSE,
    account_active BOOLEAN DEFAULT TRUE,
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'premium', 'institution')),
    tier_updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    profile_image_url TEXT,
    bio TEXT,
    preferences JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- 2. TOPICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    category TEXT,
    difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    curriculum_name TEXT,
    curriculum_version TEXT,
    video_count INTEGER DEFAULT 0,
    user_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    language TEXT DEFAULT 'en',
    is_featured BOOLEAN DEFAULT FALSE,
    popularity_score FLOAT DEFAULT 0
);

-- ============================================
-- 3. VIDEOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    channel_id TEXT,
    channel_name TEXT,
    duration_seconds INTEGER,
    transcript_cached BOOLEAN DEFAULT FALSE,
    transcript TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    language TEXT DEFAULT 'en'
);

-- ============================================
-- 4. VIDEO_SCORES TABLE (EQS)
-- ============================================
CREATE TABLE IF NOT EXISTS video_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    eqs_algorithm_version TEXT NOT NULL,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    pedagogical_score INTEGER,
    credibility_score INTEGER,
    length_score INTEGER,
    engagement_score INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    evaluated_at TIMESTAMP,
    next_reevaluation_at TIMESTAMP,
    is_valid BOOLEAN DEFAULT TRUE,
    invalidated_at TIMESTAMP,
    UNIQUE(video_id, eqs_algorithm_version)
);

-- ============================================
-- 5. USER_PROGRESS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    videos_watched INTEGER DEFAULT 0,
    videos_total INTEGER DEFAULT 0,
    completion_percentage INTEGER DEFAULT 0,
    quiz_attempts INTEGER DEFAULT 0,
    quiz_score FLOAT,
    concepts_learned INTEGER DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT NOW(),
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'mastered')),
    UNIQUE(user_id, topic_id)
);

-- ============================================
-- 6. PATH_SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS path_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
    session_number INTEGER,
    video_watched BOOLEAN DEFAULT FALSE,
    watch_percentage INTEGER DEFAULT 0,
    timestamp_watched TEXT,
    post_video_question TEXT,
    post_video_answer TEXT,
    answer_feedback TEXT,
    answer_score INTEGER,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    notes TEXT
);

-- ============================================
-- 7. CONCEPT_GRAPHS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS concept_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    concepts TEXT[] NOT NULL,
    prerequisites JSONB DEFAULT '{}'::jsonb,
    concept_order TEXT[] NOT NULL,
    algorithm_version TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(topic_id, algorithm_version)
);

-- ============================================
-- 8. LEARNING_PATHS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS learning_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    path_name TEXT,
    video_sequence UUID[] NOT NULL,
    algorithm_version TEXT NOT NULL,
    generation_timestamp TIMESTAMP DEFAULT NOW(),
    average_eqs_score FLOAT,
    path_confidence FLOAT,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(topic_id, algorithm_version)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_topics_name ON topics(name);
CREATE INDEX IF NOT EXISTS idx_topics_keywords ON topics USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);

CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_id);
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);

CREATE INDEX IF NOT EXISTS idx_video_scores_video_id ON video_scores(video_id);
CREATE INDEX IF NOT EXISTS idx_video_scores_topic_id ON video_scores(topic_id);
CREATE INDEX IF NOT EXISTS idx_video_scores_score ON video_scores(score);
CREATE INDEX IF NOT EXISTS idx_video_scores_algorithm_version ON video_scores(eqs_algorithm_version);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_topic_id ON user_progress(topic_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_status ON user_progress(status);
CREATE INDEX IF NOT EXISTS idx_user_progress_completed_at ON user_progress(completed_at);

CREATE INDEX IF NOT EXISTS idx_path_sessions_user_id ON path_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_path_sessions_video_id ON path_sessions(video_id);
CREATE INDEX IF NOT EXISTS idx_path_sessions_started_at ON path_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_concept_graphs_topic_id ON concept_graphs(topic_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_topic_id ON learning_paths(topic_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_is_active ON learning_paths(is_active);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;

-- Users: own data only
CREATE POLICY "Users can view own data"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Topics, Videos, Scores, Paths, Concepts: public read
CREATE POLICY "Topics are public"
    ON topics FOR SELECT
    USING (true);

CREATE POLICY "Videos are public"
    ON videos FOR SELECT
    USING (true);

CREATE POLICY "Video scores are public"
    ON video_scores FOR SELECT
    USING (true);

CREATE POLICY "Concept graphs are public"
    ON concept_graphs FOR SELECT
    USING (true);

CREATE POLICY "Learning paths are public"
    ON learning_paths FOR SELECT
    USING (true);

-- User progress: own data only
CREATE POLICY "Users can view own progress"
    ON user_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
    ON user_progress FOR UPDATE
    USING (auth.uid() = user_id);

-- Path sessions: own data only
CREATE POLICY "Users can view own sessions"
    ON path_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
    ON path_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_update_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER topics_update_timestamp
    BEFORE UPDATE ON topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO topics (name, description, keywords, category, difficulty, curriculum_name)
VALUES
    ('Photosynthesis', 'How plants convert sunlight to energy', ARRAY['plants', 'biology', 'photosynthesis', 'energy'], 'Biology', 'beginner', 'WAEC Biology'),
    ('Chemical Reactions', 'Understanding chemical bonds and reactions', ARRAY['chemistry', 'reactions', 'bonds'], 'Chemistry', 'intermediate', 'WAEC Chemistry'),
    ('Python Basics', 'Introduction to Python programming', ARRAY['python', 'programming', 'coding'], 'Computer Science', 'beginner', 'General IT')
ON CONFLICT (name) DO NOTHING;
