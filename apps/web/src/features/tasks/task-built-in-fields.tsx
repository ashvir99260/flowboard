'use client';

import { PrioritySchema } from '@flowboard/contracts';
import { FormFields } from '@flowboard/forms';

import { TaskDescription } from './task-description';

import type { assembleTaskDetail } from './task-detail-data';
import type { TaskDraft } from './task-form-data';
import type { Task } from '@flowboard/contracts';
import type { FormFieldConfig } from '@flowboard/forms';
import type { Control } from 'react-hook-form';

type Detail = Extract<ReturnType<typeof assembleTaskDetail>, { state: 'ready' }>;

export function TaskBuiltInFields({
  baseline,
  busy,
  control,
  detail,
}: {
  baseline?: Task;
  busy: boolean;
  control: Control<TaskDraft>;
  detail: Detail;
}) {
  const fields: FormFieldConfig<TaskDraft>[] = [
    {
      kind: 'select',
      name: 'statusId',
      label: 'Status',
      required: true,
      options: detail.statuses.map((status) => ({ value: status.id, label: status.name })),
    },
    {
      kind: 'select',
      name: 'priority',
      label: 'Priority',
      options: PrioritySchema.options.map((value) => ({ value, label: value })),
    },
    {
      kind: 'datetime-local',
      name: 'dueDate',
      label: 'Due date (UTC)',
      hint: 'Enter the date and time in UTC.',
      emptyValue: 'null',
    },
    {
      kind: 'multi_select',
      name: 'assigneeIds',
      label: 'Assignees',
      hint: 'Select members who can access this list.',
      options: [
        ...(baseline?.assignees ?? [])
          .filter((member) => !detail.members.some((item) => item.userId === member.id))
          .map((member) => ({ value: member.id, label: `${member.name} (no longer assignable)` })),
        ...detail.members.map((member) => ({ value: member.userId, label: member.name })),
      ],
    },
  ];

  return (
    <>
      <FormFields
        control={control}
        disabled={busy}
        fields={[{ kind: 'text', name: 'title', label: 'Title', required: true }]}
      />
      <TaskDescription control={control} busy={busy} />
      <FormFields control={control} disabled={busy} fields={fields} />
    </>
  );
}
