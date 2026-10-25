CREATE INDEX tasks_live_search_idx ON tasks USING GIN (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
) WHERE archived_at IS NULL;
