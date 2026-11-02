'use client';

import { TaskSearch } from './TaskSearch';

import type { TaskTableQuery } from './listLocation';

type ListToolbarProps = {
  onChange: (query: TaskTableQuery) => void;
  pending: boolean;
  query: TaskTableQuery;
};

export function ListToolbar({ query, onChange, pending }: ListToolbarProps) {
  return <TaskSearch key={query.q ?? ''} query={query} onChange={onChange} pending={pending} />;
}
