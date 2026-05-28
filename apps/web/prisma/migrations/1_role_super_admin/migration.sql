-- Rename Role.OWNER → Role.SUPER_ADMIN
-- Uses CASE in USING clause to remap existing data without a data-loss step.
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MEMBER');
ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE "role"::text
      WHEN 'OWNER' THEN 'SUPER_ADMIN'
      ELSE "role"::text
    END::"Role_new"
  );
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;
