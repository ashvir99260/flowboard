'use client';

import { useState } from 'react';

import { selectBulkTasks } from './bulkTaskData';

import type { Task } from '@flowboard/contracts';

export function useBulkTaskSelection(items: readonly Task[], querySignature: string) {
  const [selection, setSelection] = useState<{ querySignature: string; tasks: readonly Task[] }>({
    querySignature,
    tasks: [],
  });

  if (selection.querySignature !== querySignature) setSelection({ querySignature, tasks: [] });

  const selectedTasks = selection.querySignature === querySignature ? selection.tasks : [];

  return {
    selectedTasks,
    selectedIds: selectedTasks.map(({ id }) => id),
    select: (ids: readonly string[]) =>
      setSelection((current) => ({
        querySignature,
        tasks: selectBulkTasks(
          current.querySignature === querySignature ? current.tasks : [],
          ids,
          items,
        ),
      })),
    clear: () => setSelection({ querySignature, tasks: [] }),
  };
}
