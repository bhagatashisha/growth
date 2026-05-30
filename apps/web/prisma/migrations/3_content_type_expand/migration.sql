-- Adds content types for Twitter/X, Reddit, and Indie Hackers channels.
-- These were previously added via db push on UAT; this migration captures them
-- formally so prod and future envs stay in sync.

ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'X_THREAD';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'REDDIT_POST';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'INDIE_HACKERS_POST';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'REDDIT_COMMENT';
