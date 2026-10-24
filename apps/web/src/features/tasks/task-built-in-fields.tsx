'use client';

import { PrioritySchema } from '@flowboard/contracts';
import { FormField } from '@flowboard/ui';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import NativeSelect from '@mui/material/NativeSelect';
import { useId } from 'react';
import { Controller } from 'react-hook-form';

import { TaskDescription } from './task-description';

import type { assembleTaskDetail } from './task-detail-data';
import type { TaskDraft } from './task-form-data';
import type { Task } from '@flowboard/contracts';
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
  const assigneeId = useId();

  return (
    <>
      <Controller
        name="title"
        control={control}
        render={({ field: { ref, ...input }, fieldState }) => (
          <FormField
            {...input}
            inputRef={ref}
            label="Title"
            required
            disabled={busy}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <TaskDescription control={control} busy={busy} />
      <Controller
        name="statusId"
        control={control}
        render={({ field: { ref, ...input }, fieldState }) => (
          <FormField
            {...input}
            inputRef={ref}
            label="Status"
            select
            required
            disabled={busy}
            errorMessage={fieldState.error?.message}
            slotProps={{ select: { native: true } }}
          >
            {detail.statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </FormField>
        )}
      />
      <Controller
        name="priority"
        control={control}
        render={({ field: { ref, ...input }, fieldState }) => (
          <FormField
            {...input}
            inputRef={ref}
            label="Priority"
            select
            disabled={busy}
            errorMessage={fieldState.error?.message}
            slotProps={{ select: { native: true } }}
          >
            {PrioritySchema.options.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </FormField>
        )}
      />
      <Controller
        name="dueDate"
        control={control}
        render={({ field, fieldState }) => (
          <FormField
            inputRef={field.ref}
            name={field.name}
            onBlur={field.onBlur}
            value={field.value ?? ''}
            onChange={(event) => field.onChange(event.target.value || null)}
            label="Due date"
            type="date"
            disabled={busy}
            errorMessage={fieldState.error?.message}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
      />
      <Controller
        name="assigneeIds"
        control={control}
        render={({ field, fieldState }) => (
          <FormControl disabled={busy} error={Boolean(fieldState.error)}>
            <InputLabel shrink htmlFor={assigneeId}>
              Assignees
            </InputLabel>
            <NativeSelect
              inputRef={field.ref}
              onBlur={field.onBlur}
              value={field.value}
              onChange={(event) =>
                field.onChange(Array.from(event.target.selectedOptions, (option) => option.value))
              }
              inputProps={{
                id: assigneeId,
                name: field.name,
                multiple: true,
                'aria-describedby': `${assigneeId}-help`,
              }}
            >
              {(baseline?.assignees ?? [])
                .filter((member) => !detail.members.some((item) => item.userId === member.id))
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} (no longer assignable)
                  </option>
                ))}
              {detail.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </NativeSelect>
            <FormHelperText id={`${assigneeId}-help`}>
              {fieldState.error?.message ?? 'Select members who can access this list.'}
            </FormHelperText>
          </FormControl>
        )}
      />
    </>
  );
}
