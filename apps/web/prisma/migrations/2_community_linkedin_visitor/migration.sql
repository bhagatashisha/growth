-- Migration: Community Scout + LinkedIn Queue + Visitor Intent
-- Replaces RedditMention/RedditScanLog/RedditScanState with unified Community models.
-- Migrates any existing Reddit data before dropping old tables.

-- ─── New enums ────────────────────────────────────────────────────────────────

CREATE TYPE "CommunitySource" AS ENUM ('REDDIT', 'HACKERNEWS', 'INDIE_HACKERS');
CREATE TYPE "LinkedInStatus" AS ENUM ('PENDING', 'SENT', 'REPLIED', 'DEAD');

-- ─── CommunityMention (replaces RedditMention) ───────────────────────────────

CREATE TABLE "CommunityMention" (
  "id"               TEXT NOT NULL,
  "source"           "CommunitySource" NOT NULL DEFAULT 'REDDIT',
  "externalId"       TEXT NOT NULL,
  "subreddit"        TEXT,
  "title"            TEXT NOT NULL,
  "body"             TEXT,
  "url"              TEXT NOT NULL,
  "author"           TEXT NOT NULL,
  "score"            INTEGER NOT NULL DEFAULT 0,
  "numComments"      INTEGER NOT NULL DEFAULT 0,
  "createdUtc"       INTEGER NOT NULL,
  "intentScore"      INTEGER,
  "intentReason"     TEXT,
  "icpSignal"        TEXT,
  "replyVariants"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "approvedAt"       TIMESTAMP(3),
  "dismissedAt"      TIMESTAMP(3),
  "postedManuallyAt" TIMESTAMP(3),
  "postedUrl"        TEXT,
  "scannedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityMention_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityMention_source_externalId_key" ON "CommunityMention"("source", "externalId");
CREATE INDEX "CommunityMention_status_idx" ON "CommunityMention"("status");
CREATE INDEX "CommunityMention_source_createdUtc_idx" ON "CommunityMention"("source", "createdUtc");
CREATE INDEX "CommunityMention_intentScore_idx" ON "CommunityMention"("intentScore");

-- Migrate existing Reddit data (conditional — table may not exist on fresh envs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RedditMention') THEN
    INSERT INTO "CommunityMention" (
      "id", "source", "externalId", "subreddit", "title", "body", "url", "author",
      "score", "numComments", "createdUtc", "intentScore", "intentReason", "icpSignal",
      "replyVariants", "status", "approvedAt", "dismissedAt", "postedManuallyAt",
      "postedUrl", "scannedAt", "updatedAt"
    )
    SELECT
      "id", 'REDDIT'::"CommunitySource", "redditPostId", "subreddit", "title", "body",
      "url", "author", "score", "numComments", "createdUtc", "intentScore", "intentReason",
      "icpSignal", "replyVariants", "status", "approvedAt", "dismissedAt", "postedManuallyAt",
      "postedUrl", "scannedAt", "updatedAt"
    FROM "RedditMention"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS "RedditMention";

-- ─── CommunityScanLog (replaces RedditScanLog) ───────────────────────────────

CREATE TABLE "CommunityScanLog" (
  "id"         TEXT NOT NULL,
  "source"     "CommunitySource" NOT NULL,
  "keyword"    TEXT NOT NULL,
  "postsFound" INTEGER NOT NULL DEFAULT 0,
  "newPosts"   INTEGER NOT NULL DEFAULT 0,
  "error"      TEXT,
  "durationMs" INTEGER,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityScanLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityScanLog_createdAt_idx" ON "CommunityScanLog"("createdAt");
CREATE INDEX "CommunityScanLog_source_keyword_idx" ON "CommunityScanLog"("source", "keyword");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RedditScanLog') THEN
    INSERT INTO "CommunityScanLog" ("id", "source", "keyword", "postsFound", "newPosts", "error", "durationMs", "createdAt")
    SELECT "id", 'REDDIT'::"CommunitySource", "keyword", "postsFound", "newPosts", "error", "durationMs", "createdAt"
    FROM "RedditScanLog"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS "RedditScanLog";

-- ─── CommunityScanState (replaces RedditScanState) ───────────────────────────

CREATE TABLE "CommunityScanState" (
  "id"                TEXT NOT NULL,
  "source"            "CommunitySource" NOT NULL,
  "keyword"           TEXT NOT NULL,
  "lastScannedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityScanState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityScanState_source_keyword_key" ON "CommunityScanState"("source", "keyword");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RedditScanState') THEN
    INSERT INTO "CommunityScanState" ("id", "source", "keyword", "lastScannedAt", "consecutiveErrors", "updatedAt")
    SELECT "id", 'REDDIT'::"CommunitySource", "keyword", "lastScannedAt", "consecutiveErrors", "updatedAt"
    FROM "RedditScanState"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS "RedditScanState";

-- ─── LinkedInOutreach ────────────────────────────────────────────────────────

CREATE TABLE "LinkedInOutreach" (
  "id"                  TEXT NOT NULL,
  "contactId"           TEXT NOT NULL,
  "connectionNoteDraft" TEXT NOT NULL,
  "messageDraft"        TEXT NOT NULL,
  "connectionSentAt"    TIMESTAMP(3),
  "repliedAt"           TIMESTAMP(3),
  "status"              "LinkedInStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LinkedInOutreach_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LinkedInOutreach_contactId_key" ON "LinkedInOutreach"("contactId");
CREATE INDEX "LinkedInOutreach_status_idx" ON "LinkedInOutreach"("status");

ALTER TABLE "LinkedInOutreach"
  ADD CONSTRAINT "LinkedInOutreach_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE;

-- ─── VisitorEvent ────────────────────────────────────────────────────────────

CREATE TABLE "VisitorEvent" (
  "id"          TEXT NOT NULL,
  "ip"          TEXT NOT NULL,
  "orgName"     TEXT,
  "page"        TEXT NOT NULL,
  "referrer"    TEXT,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "sessionId"   TEXT,
  "companyId"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisitorEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitorEvent_createdAt_idx" ON "VisitorEvent"("createdAt");
CREATE INDEX "VisitorEvent_companyId_idx" ON "VisitorEvent"("companyId");

-- ─── ContentDraft additions ───────────────────────────────────────────────────

ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "platform"     TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "postedAt"     TIMESTAMP(3);
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "postedLink"   TEXT;

CREATE INDEX IF NOT EXISTS "ContentDraft_status_scheduledFor_idx" ON "ContentDraft"("status", "scheduledFor");

-- ─── acquisitionSource on Company + Trial ────────────────────────────────────

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "acquisitionSource" TEXT;
ALTER TABLE "Trial"   ADD COLUMN IF NOT EXISTS "acquisitionSource" TEXT;
