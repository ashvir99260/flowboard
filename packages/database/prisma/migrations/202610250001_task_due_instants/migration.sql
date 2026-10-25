BEGIN;

ALTER TABLE tasks DROP CONSTRAINT tasks_due_date_check;
ALTER TABLE tasks ALTER COLUMN due_date TYPE timestamptz(3)
  USING due_date::timestamp AT TIME ZONE 'UTC';
ALTER TABLE tasks ADD CONSTRAINT tasks_due_date_check CHECK (
  due_date IS NULL OR (
    due_date >= TIMESTAMPTZ '0001-01-01 00:00:00+00'
    AND due_date <= TIMESTAMPTZ '9999-12-31 23:59:59.999+00'
  )
);

-- Queued jobs contain references and reload these persisted event payloads.
-- Preserve every unrelated payload field and explicit nulls.
UPDATE outbox_events
SET payload = jsonb_set(payload, '{changes,dueDate,before}',
  to_jsonb((payload #>> '{changes,dueDate,before}') || 'T00:00:00.000Z'), false)
WHERE event_type = 'task.updated'
  AND jsonb_typeof(payload #> '{changes,dueDate,before}') = 'string'
  AND (payload #>> '{changes,dueDate,before}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

UPDATE outbox_events
SET payload = jsonb_set(payload, '{changes,dueDate,after}',
  to_jsonb((payload #>> '{changes,dueDate,after}') || 'T00:00:00.000Z'), false)
WHERE event_type = 'task.updated'
  AND jsonb_typeof(payload #> '{changes,dueDate,after}') = 'string'
  AND (payload #>> '{changes,dueDate,after}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

COMMIT;
