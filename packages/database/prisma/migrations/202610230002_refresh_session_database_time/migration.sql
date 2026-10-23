-- Reassert server defaults when switching Prisma from host-generated now().
-- Existing rows and lifecycle constraints are unchanged.
ALTER TABLE "refresh_sessions"
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
