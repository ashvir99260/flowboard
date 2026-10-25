'use client';

import { TaskSearch } from './TaskSearch';

import type { TaskTableQuery } from './listLocation';

export function ListToolbar({
  query,
  onChange,
  pending,
}: {
  onChange: (query: TaskTableQuery) => void;
  pending: boolean;
  query: TaskTableQuery;
}) {
  return <TaskSearch key={query.q ?? ''} query={query} onChange={onChange} pending={pending} />;
}
