-- Migration: Add user preference columns to users table
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS haptic_feedback_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
