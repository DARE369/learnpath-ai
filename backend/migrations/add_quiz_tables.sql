-- NEW-PACKET-C: Interactive Quiz System with Adaptive Difficulty (IRT)
-- Migration: Add quiz-related tables

-- Create quiz_sessions table
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id),
    session_started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    session_completed_at TIMESTAMP,
    quiz_type VARCHAR(50) DEFAULT 'section',
    total_questions INTEGER DEFAULT 5,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    score_percent INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    avg_time_per_question INTEGER DEFAULT 0,
    estimated_ability FLOAT DEFAULT 0.0,
    ability_range JSONB DEFAULT '{}',
    weak_concepts TEXT[] DEFAULT '{}',
    strong_concepts TEXT[] DEFAULT '{}',
    performance_level VARCHAR(50),
    recommendation TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_quiz_sessions_topic_id ON quiz_sessions(topic_id);
CREATE INDEX IF NOT EXISTS ix_quiz_sessions_created_at ON quiz_sessions(created_at);

-- Create quiz_questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id),
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'multiple_choice',
    options JSONB DEFAULT '[]',
    difficulty_parameter FLOAT DEFAULT 0.0,
    discrimination_parameter FLOAT DEFAULT 1.0,
    guessing_parameter FLOAT DEFAULT 0.0,
    correct_answer_id VARCHAR(10),
    explanation TEXT,
    explanation_for_each_option JSONB DEFAULT '{}',
    concept_id VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_quiz_questions_topic_id ON quiz_questions(topic_id);
CREATE INDEX IF NOT EXISTS ix_quiz_questions_concept_id ON quiz_questions(concept_id);
CREATE INDEX IF NOT EXISTS ix_quiz_questions_created_at ON quiz_questions(created_at);

-- Create quiz_responses table
CREATE TABLE IF NOT EXISTS quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES quiz_questions(id),
    user_answer_id VARCHAR(10),
    is_correct BOOLEAN DEFAULT FALSE,
    confidence_rating INTEGER DEFAULT 5,
    confidence_appropriate BOOLEAN DEFAULT FALSE,
    time_spent_seconds INTEGER DEFAULT 0,
    learner_ability_before FLOAT DEFAULT 0.0,
    learner_ability_after FLOAT DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_quiz_responses_user_id ON quiz_responses(user_id);
CREATE INDEX IF NOT EXISTS ix_quiz_responses_quiz_session_id ON quiz_responses(quiz_session_id);
CREATE INDEX IF NOT EXISTS ix_quiz_responses_question_id ON quiz_responses(question_id);
CREATE INDEX IF NOT EXISTS ix_quiz_responses_created_at ON quiz_responses(created_at);

-- Create concept_mastery table
CREATE TABLE IF NOT EXISTS concept_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    concept_id VARCHAR(100) NOT NULL,
    questions_attempted INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    accuracy_percent INTEGER DEFAULT 0,
    is_mastered BOOLEAN DEFAULT FALSE,
    mastered_date TIMESTAMP,
    last_attempted TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_concept_mastery_user_id ON concept_mastery(user_id);
CREATE INDEX IF NOT EXISTS ix_concept_mastery_concept_id ON concept_mastery(concept_id);
CREATE INDEX IF NOT EXISTS ix_concept_mastery_user_concept ON concept_mastery(user_id, concept_id);

-- Create fsrs_cards table (Spaced Repetition)
CREATE TABLE IF NOT EXISTS fsrs_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type VARCHAR(50) DEFAULT 'quiz_question',
    source_id UUID,
    state VARCHAR(50) DEFAULT 'new',
    due_date TIMESTAMP NOT NULL DEFAULT NOW(),
    stability FLOAT DEFAULT 1.0,
    difficulty FLOAT DEFAULT 5.0,
    elapsed_days INTEGER DEFAULT 0,
    scheduled_days INTEGER DEFAULT 1,
    reps INTEGER DEFAULT 0,
    lapses INTEGER DEFAULT 0,
    last_reviewed TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_fsrs_cards_user_id ON fsrs_cards(user_id);
CREATE INDEX IF NOT EXISTS ix_fsrs_cards_due_date ON fsrs_cards(due_date);
CREATE INDEX IF NOT EXISTS ix_fsrs_cards_state ON fsrs_cards(state);

-- Add comments
COMMENT ON TABLE quiz_sessions IS 'Quiz session - groups all questions in one quiz attempt (NEW-PACKET-C)';
COMMENT ON TABLE quiz_questions IS 'Quiz questions - cached for fast loading (NEW-PACKET-C)';
COMMENT ON TABLE quiz_responses IS 'User quiz responses - core data for IRT + analytics (NEW-PACKET-C)';
COMMENT ON TABLE concept_mastery IS 'Concept mastery tracking - aggregate progress per concept (NEW-PACKET-C)';
COMMENT ON TABLE fsrs_cards IS 'Spaced repetition cards (FSRS scheduling) (NEW-PACKET-C)';
