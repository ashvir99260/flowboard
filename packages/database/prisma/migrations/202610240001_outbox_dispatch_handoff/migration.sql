ALTER TYPE "OutboxState" ADD VALUE 'dispatching';
ALTER TYPE "OutboxState" ADD VALUE 'queued';

-- Text comparisons avoid using freshly added enum literals before migration commit.
ALTER TABLE outbox_events DROP CONSTRAINT outbox_events_delivery_check;
ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_delivery_check CHECK (
  ((lease_owner IS NULL) = (lease_until IS NULL))
  AND ((state::text IN ('dispatching', 'processing')) = (lease_owner IS NOT NULL))
  AND ((state = 'delivered') = (completed_at IS NOT NULL))
  AND (completed_at IS NULL OR completed_at >= created_at)
  AND (lease_owner IS NULL OR (char_length(lease_owner) BETWEEN 1 AND 128 AND lease_owner !~ '^[[:space:]]*$'))
  AND (last_error_code IS NULL OR (char_length(last_error_code) BETWEEN 1 AND 64 AND last_error_code !~ '^[[:space:]]*$'))
);
