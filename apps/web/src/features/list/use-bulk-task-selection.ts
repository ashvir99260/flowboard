'use client';

import { useState } from 'react';

import { selectBulkTasks } from './bulk-task-data';

import type { Task } from '@flowboard/contracts';

export function useBulkTaskSelection(items: readonly Task[]) {
  const [selectedTasks, setSelectedTasks] = useState<readonly Task[]>([]);

  return {
    selectedTasks,
    selectedIds: selectedTasks.map(({ id }) => id),
    select: (ids: readonly string[]) =>
      setSelectedTasks((current) => selectBulkTasks(current, ids, items)),
    clear: () => setSelectedTasks([]),
  };
}
