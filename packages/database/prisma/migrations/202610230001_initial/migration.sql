-- Keep PostgreSQL DDL atomic if any statement fails.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('space', 'folder', 'list');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('workspace', 'space', 'folder', 'list');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "PermissionMode" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "StatusCategory" AS ENUM ('not_started', 'active', 'done', 'closed');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('text', 'number', 'single_select', 'multi_select', 'date', 'checkbox');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('urgent', 'high', 'normal', 'low', 'none');

-- CreateEnum
CREATE TYPE "OutboxState" AS ENUM ('pending', 'processing', 'delivered', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "config_version" INTEGER NOT NULL DEFAULT 1,
    "data_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("workspace_id","user_id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "active_workspace_id" UUID,
    "token_digest" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "token_digest" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "accepted_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContainerType" NOT NULL,
    "parent_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "visibility" "Visibility" NOT NULL DEFAULT 'public',
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grants" (
    "workspace_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mode" "PermissionMode" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grants_pkey" PRIMARY KEY ("workspace_id","resource_id","user_id")
);

-- CreateTable
CREATE TABLE "status_identities" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "category" "StatusCategory" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_overrides" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "owner_type" "ScopeType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT,
    "color" TEXT,
    "position" INTEGER,
    "hidden" BOOLEAN,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "owner_type" "ScopeType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status_id" UUID NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'none',
    "due_date" DATE,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "primary_list_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "workspace_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("workspace_id","task_id","user_id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "actor_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "OutboxState" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" TEXT,
    "lease_until" TIMESTAMPTZ(3),
    "last_error_code" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seed_states" (
    "version" TEXT NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seed_states_pkey" PRIMARY KEY ("version")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_user_id_workspace_id_idx" ON "memberships"("user_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_digest_key" ON "refresh_sessions"("token_digest");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_family_id_revoked_at_expires_at_idx" ON "refresh_sessions"("user_id", "family_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_user_id_family_id_id_key" ON "refresh_sessions"("user_id", "family_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_digest_key" ON "invitations"("token_digest");

-- CreateIndex
CREATE INDEX "invitations_workspace_id_email_accepted_at_expires_at_idx" ON "invitations"("workspace_id", "email", "accepted_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_workspace_id_id_key" ON "invitations"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "nodes_workspace_id_parent_id_archived_at_position_id_idx" ON "nodes"("workspace_id", "parent_id", "archived_at", "position", "id");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_workspace_id_id_key" ON "nodes"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "grants_workspace_id_user_id_resource_id_idx" ON "grants"("workspace_id", "user_id", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "status_identities_workspace_id_id_key" ON "status_identities"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "status_identities_workspace_id_key_key" ON "status_identities"("workspace_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "status_overrides_workspace_id_id_key" ON "status_overrides"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "status_overrides_workspace_id_owner_type_owner_id_status_id_key" ON "status_overrides"("workspace_id", "owner_type", "owner_id", "status_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_workspace_id_id_key" ON "field_definitions"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_workspace_id_owner_type_owner_id_key_key" ON "field_definitions"("workspace_id", "owner_type", "owner_id", "key");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_primary_list_id_archived_at_status_id_po_idx" ON "tasks"("workspace_id", "primary_list_id", "archived_at", "status_id", "position", "id");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_primary_list_id_archived_at_due_date_id_idx" ON "tasks"("workspace_id", "primary_list_id", "archived_at", "due_date", "id");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_primary_list_id_archived_at_priority_id_idx" ON "tasks"("workspace_id", "primary_list_id", "archived_at", "priority", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_workspace_id_id_key" ON "tasks"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "task_assignees_workspace_id_user_id_task_id_idx" ON "task_assignees"("workspace_id", "user_id", "task_id");

-- CreateIndex
CREATE INDEX "outbox_events_state_next_attempt_at_id_idx" ON "outbox_events"("state", "next_attempt_at", "id");

-- CreateIndex
CREATE INDEX "outbox_events_state_lease_until_id_idx" ON "outbox_events"("state", "lease_until", "id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_workspace_id_id_key" ON "outbox_events"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_workspace_id_aggregate_type_aggregate_id_aggr_key" ON "outbox_events"("workspace_id", "aggregate_type", "aggregate_id", "aggregate_version");

-- CreateIndex
CREATE UNIQUE INDEX "activities_event_id_key" ON "activities"("event_id");

-- CreateIndex
CREATE INDEX "activities_workspace_id_task_id_created_at_id_idx" ON "activities"("workspace_id", "task_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "activities_workspace_id_id_key" ON "activities"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "activities_workspace_id_event_id_key" ON "activities"("workspace_id", "event_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_active_workspace_id_fkey" FOREIGN KEY ("active_workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_family_id_replaced_by_id_fkey" FOREIGN KEY ("user_id", "family_id", "replaced_by_id") REFERENCES "refresh_sessions"("user_id", "family_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_workspace_id_parent_id_fkey" FOREIGN KEY ("workspace_id", "parent_id") REFERENCES "nodes"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_workspace_id_resource_id_fkey" FOREIGN KEY ("workspace_id", "resource_id") REFERENCES "nodes"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_workspace_id_user_id_fkey" FOREIGN KEY ("workspace_id", "user_id") REFERENCES "memberships"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "status_identities" ADD CONSTRAINT "status_identities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "status_overrides" ADD CONSTRAINT "status_overrides_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "status_overrides" ADD CONSTRAINT "status_overrides_workspace_id_status_id_fkey" FOREIGN KEY ("workspace_id", "status_id") REFERENCES "status_identities"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_primary_list_id_fkey" FOREIGN KEY ("workspace_id", "primary_list_id") REFERENCES "nodes"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_status_id_fkey" FOREIGN KEY ("workspace_id", "status_id") REFERENCES "status_identities"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_workspace_id_task_id_fkey" FOREIGN KEY ("workspace_id", "task_id") REFERENCES "tasks"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_workspace_id_user_id_fkey" FOREIGN KEY ("workspace_id", "user_id") REFERENCES "memberships"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_workspace_id_task_id_fkey" FOREIGN KEY ("workspace_id", "task_id") REFERENCES "tasks"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_workspace_id_event_id_fkey" FOREIGN KEY ("workspace_id", "event_id") REFERENCES "outbox_events"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- SQL invariants not represented by the Prisma schema language.
ALTER TABLE "users" ADD CONSTRAINT "users_name_check" CHECK (char_length(name) BETWEEN 1 AND 120 AND name !~ '^[[:space:]]*$');
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_name_check" CHECK (char_length(name) BETWEEN 1 AND 120 AND name !~ '^[[:space:]]*$');
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_name_check" CHECK (char_length(name) BETWEEN 1 AND 120 AND name !~ '^[[:space:]]*$');
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_name_check" CHECK (char_length(name) BETWEEN 1 AND 120 AND name !~ '^[[:space:]]*$');
ALTER TABLE "users" ADD CONSTRAINT "users_email_check" CHECK (char_length(email) BETWEEN 1 AND 254 AND email !~ '^[[:space:]]*$' AND email = lower(btrim(email)));
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_email_check" CHECK (char_length(email) BETWEEN 1 AND 254 AND email !~ '^[[:space:]]*$' AND email = lower(btrim(email)));
ALTER TABLE "users" ADD CONSTRAINT "users_password_hash_check" CHECK (char_length(password_hash) BETWEEN 1 AND 512 AND password_hash !~ '^[[:space:]]*$');
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_revisions_check" CHECK (config_version > 0 AND data_version > 0);
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_digest_check" CHECK (token_digest ~ '^[0-9a-f]{64}$');
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_digest_check" CHECK (token_digest ~ '^[0-9a-f]{64}$');
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_lifecycle_check" CHECK (expires_at > created_at AND (used_at IS NULL OR used_at >= created_at) AND (revoked_at IS NULL OR revoked_at >= created_at) AND (replaced_by_id IS NULL OR (replaced_by_id <> id AND used_at IS NOT NULL)));
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_lifecycle_check" CHECK (expires_at > created_at AND ((accepted_at IS NULL) = (accepted_by_id IS NULL)) AND (accepted_at IS NULL OR (accepted_at >= created_at AND accepted_at < expires_at)));
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_shape_check" CHECK (((type = 'space' AND parent_id IS NULL) OR (type IN ('folder', 'list') AND parent_id IS NOT NULL)) AND (parent_id IS NULL OR parent_id <> id));
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_version_archive_check" CHECK (version > 0 AND (archived_at IS NULL OR archived_at >= created_at));
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_version_archive_check" CHECK (version > 0 AND (archived_at IS NULL OR archived_at >= created_at));
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_position_check" CHECK (position >= 0);
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_position_check" CHECK (position >= 0);
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_position_check" CHECK (position >= 0);
ALTER TABLE "status_identities" ADD CONSTRAINT "status_identities_key_check" CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$');
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_key_check" CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$');
ALTER TABLE "status_overrides" ADD CONSTRAINT "status_overrides_workspace_owner_check" CHECK (owner_type <> 'workspace' OR owner_id = workspace_id);
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_workspace_owner_check" CHECK (owner_type <> 'workspace' OR owner_id = workspace_id);
ALTER TABLE "status_overrides" ADD CONSTRAINT "status_overrides_display_check" CHECK ((name IS NULL OR (char_length(name) BETWEEN 1 AND 120 AND name !~ '^[[:space:]]*$')) AND (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$') AND (position IS NULL OR position >= 0));
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_options_check" CHECK (jsonb_typeof(options) = 'array');
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_check" CHECK (char_length(title) BETWEEN 1 AND 500 AND title !~ '^[[:space:]]*$');
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_fields_check" CHECK (jsonb_typeof(custom_fields) = 'object');
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_due_date_check" CHECK (due_date IS NULL OR (due_date >= DATE '0001-01-01' AND due_date <= DATE '9999-12-31'));
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_versions_check" CHECK (aggregate_version > 0 AND schema_version > 0 AND attempts >= 0);
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_types_check" CHECK (char_length(aggregate_type) BETWEEN 1 AND 64 AND aggregate_type !~ '^[[:space:]]*$' AND char_length(event_type) BETWEEN 1 AND 128 AND event_type !~ '^[[:space:]]*$');
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_delivery_check" CHECK (((lease_owner IS NULL) = (lease_until IS NULL)) AND ((state = 'processing') = (lease_owner IS NOT NULL)) AND ((state = 'delivered') = (completed_at IS NOT NULL)) AND (completed_at IS NULL OR completed_at >= created_at) AND (lease_owner IS NULL OR (char_length(lease_owner) BETWEEN 1 AND 128 AND lease_owner !~ '^[[:space:]]*$')) AND (last_error_code IS NULL OR (char_length(last_error_code) BETWEEN 1 AND 64 AND last_error_code !~ '^[[:space:]]*$')));
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_payload_check" CHECK (jsonb_typeof(payload) = 'object');
ALTER TABLE "activities" ADD CONSTRAINT "activities_payload_check" CHECK (jsonb_typeof(payload) = 'object');
ALTER TABLE "activities" ADD CONSTRAINT "activities_type_check" CHECK (char_length(type) BETWEEN 1 AND 128 AND type !~ '^[[:space:]]*$');
ALTER TABLE "seed_states" ADD CONSTRAINT "seed_states_version_check" CHECK (char_length(version) BETWEEN 1 AND 64 AND version !~ '^[[:space:]]*$' AND completed_at >= created_at);

-- Expiry is checked by the service; at most one current credential per family.
CREATE UNIQUE INDEX refresh_sessions_current_family_key
  ON refresh_sessions (family_id) WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE FUNCTION maintain_audit_timestamps() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := NEW.created_at;
  ELSE
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'created_at is immutable' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_audit BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER workspaces_audit BEFORE INSERT OR UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER memberships_audit BEFORE INSERT OR UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER refresh_sessions_audit BEFORE INSERT OR UPDATE ON refresh_sessions
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER invitations_audit BEFORE INSERT OR UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER nodes_audit BEFORE INSERT OR UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER grants_audit BEFORE INSERT OR UPDATE ON grants
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER status_identities_audit BEFORE INSERT OR UPDATE ON status_identities
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER status_overrides_audit BEFORE INSERT OR UPDATE ON status_overrides
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER field_definitions_audit BEFORE INSERT OR UPDATE ON field_definitions
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER tasks_audit BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER task_assignees_audit BEFORE INSERT OR UPDATE ON task_assignees
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER outbox_events_audit BEFORE INSERT OR UPDATE ON outbox_events
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER activities_audit BEFORE INSERT OR UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();
CREATE TRIGGER seed_states_audit BEFORE INSERT OR UPDATE ON seed_states
  FOR EACH ROW EXECUTE FUNCTION maintain_audit_timestamps();

COMMIT;
