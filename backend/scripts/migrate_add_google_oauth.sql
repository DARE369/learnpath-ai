-- Migration: add Google OAuth columns to users table
-- Run once against your Supabase database (SQL Editor)

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR UNIQUE,
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR NOT NULL DEFAULT 'email';

CREATE INDEX IF NOT EXISTS ix_users_google_id ON users(google_id);
