BEGIN;

ALTER TABLE tasks ADD COLUMN parent_task_id UUID;
ALTER TABLE tasks ADD CONSTRAINT tasks_parent_not_self
  CHECK (parent_task_id IS NULL OR parent_task_id <> id);

CREATE UNIQUE INDEX tasks_workspace_id_primary_list_id_id_key
  ON tasks(workspace_id, primary_list_id, id);
ALTER TABLE tasks ADD CONSTRAINT tasks_workspace_id_primary_list_id_parent_task_id_fkey
  FOREIGN KEY (workspace_id, primary_list_id, parent_task_id)
  REFERENCES tasks(workspace_id, primary_list_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX tasks_workspace_id_parent_task_id_archived_at_idx
  ON tasks(workspace_id, parent_task_id, archived_at);

COMMIT;
