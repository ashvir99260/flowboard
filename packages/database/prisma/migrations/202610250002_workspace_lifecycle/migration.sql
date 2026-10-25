BEGIN;
ALTER TABLE "workspaces" ADD COLUMN "archived_at" TIMESTAMPTZ(3);
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_archive_check"
  CHECK (archived_at IS NULL OR archived_at >= created_at);
COMMIT;
