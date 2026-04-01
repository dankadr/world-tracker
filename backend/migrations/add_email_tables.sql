-- Migration: add email_preferences and email_log tables
-- Run this once against the production database before deploying the email system.

-- email_preferences table
-- Stores per-user email opt-in/opt-out flags and unsubscribe state.
CREATE TABLE IF NOT EXISTS email_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    welcome_sent BOOLEAN DEFAULT FALSE,
    weekly_digest BOOLEAN DEFAULT TRUE,
    monthly_recap BOOLEAN DEFAULT TRUE,
    friend_notifications BOOLEAN DEFAULT TRUE,
    challenge_notifications BOOLEAN DEFAULT TRUE,
    bucket_list_reminders BOOLEAN DEFAULT TRUE,
    milestone_celebrations BOOLEAN DEFAULT TRUE,
    marketing BOOLEAN DEFAULT FALSE,
    unsubscribed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- email_log table
-- Append-only log of every email sent, including Resend's message ID and status.
CREATE TABLE IF NOT EXISTS email_log (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    resend_id TEXT,
    status TEXT DEFAULT 'sent'
);

-- Index for fast per-user log lookups
CREATE INDEX IF NOT EXISTS idx_email_log_user_id ON email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_email_type ON email_log(email_type, sent_at DESC);
