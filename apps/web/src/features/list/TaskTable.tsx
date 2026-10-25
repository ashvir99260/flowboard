'use client';
import { TaskTable as Table } from '@flowboard/ui';

import { useTaskEditor } from '../tasks/useTaskEditor';

import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';
export function TaskTable(props: {
  fields: readonly ResolvedField[];
  items: readonly Task[];
  statuses: readonly ResolvedStatus[];
  selection?: {
    disabled?: boolean;
    ids: readonly string[];
    onChange: (ids: string[]) => void;
  };
}) {
  const openTask = useTaskEditor();

  return <Table {...props} onOpenTask={openTask} />;
}
