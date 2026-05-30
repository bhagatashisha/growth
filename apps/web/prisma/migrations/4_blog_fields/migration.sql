-- Adds blog-specific fields to ContentDraft for SEO articles.
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "slug"            TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "targetKeyword"   TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "product"         TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ContentDraft_slug_key" ON "ContentDraft"("slug");
CREATE INDEX IF NOT EXISTS "ContentDraft_product_status_idx" ON "ContentDraft"("product", "status");
