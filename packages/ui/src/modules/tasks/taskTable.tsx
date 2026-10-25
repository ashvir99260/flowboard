'use client';

import { styled } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import { useCallback, useMemo } from 'react';

import { useRemSize } from '../../hooks/useRemSize.js';
import { Button, Stack, Typography } from '../../primitives.js';
import { CustomFieldChip } from '../forms/customFieldChip.js';

import { AssigneeAvatarGroup } from './assigneeAvatarGroup.js';
import { DueDateLabel } from './dueDateLabel.js';
import { PriorityBadge } from './priorityBadge.js';
import { StatusChip } from './statusChip.js';

import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';
import type { GridColDef } from '@mui/x-data-grid';

const Container = styled('div')({
  height: 'min(64rem, 75dvh)',
  minHeight: '28rem',
  minWidth: 0,
  maxWidth: '100%',
  width: '100%',
  position: 'relative',
});
const RemMeasure = styled('span')({
  position: 'absolute',
  width: '1rem',
  height: '1rem',
  visibility: 'hidden',
  pointerEvents: 'none',
});
const Grid = styled(DataGrid)(({ theme }) => ({
  border: 0,
  fontSize: '1.3rem',
  '--DataGrid-containerBackground': (theme.vars ?? theme).palette.background.paper,
  '--DataGrid-rowBorderColor': (theme.vars ?? theme).palette.divider,
  '& .MuiDataGrid-columnHeader': { paddingInline: theme.spacing(1.2) },
  '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
  '& .MuiDataGrid-cell': {
    display: 'flex',
    alignItems: 'center',
    minHeight: '6.4rem',
    padding: theme.spacing(0.8, 1.2),
    lineHeight: 1.5,
    whiteSpace: 'normal',
  },
  '& .MuiDataGrid-footerContainer': { minHeight: '5.6rem' },
})) as typeof DataGrid;
const OpenButton = styled(Button)({
  textAlign: 'left',
  justifyContent: 'flex-start',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
  width: '100%',
}) as typeof Button;
const autoRowHeight = () => 'auto' as const;
const pageSizeOptions = [25, 50, 100];
const initialState = { pagination: { paginationModel: { page: 0, pageSize: 50 } } };

export function TaskTable({
  items,
  fields,
  statuses,
  onOpenTask,
}: {
  fields: readonly ResolvedField[];
  items: readonly Task[];
  onOpenTask: (id: string) => void;
  statuses: readonly ResolvedStatus[];
}) {
  const { ref: remRef, size: remSize } = useRemSize();
  const estimateRowHeight = useCallback(() => 6.4 * remSize, [remSize]);
  const columns = useMemo<GridColDef<Task>[]>(() => {
    const statusById = new Map(statuses.map((status) => [status.id, status]));
    const fixed: GridColDef<Task>[] = [
      {
        field: 'title',
        headerName: 'Title',
        width: 26 * remSize,
        rowHeader: true,
        renderCell: (params) => (
          <OpenButton
            tabIndex={params.tabIndex}
            data-open-task={params.row.id}
            aria-label={`Open task: ${params.row.title}`}
            onClick={() => onOpenTask(params.row.id)}
          >
            {params.row.title}
          </OpenButton>
        ),
      },
      {
        field: 'statusId',
        headerName: 'Status',
        width: 20 * remSize,
        renderCell: ({ row }) => {
          const status = statusById.get(row.statusId);

          return status ? (
            <StatusChip status={status} />
          ) : (
            <Typography color="error">Unavailable status</Typography>
          );
        },
      },
      {
        field: 'assignees',
        headerName: 'Assignees',
        width: 16 * remSize,
        renderCell: ({ row }) => <AssigneeAvatarGroup assignees={row.assignees} />,
      },
      {
        field: 'priority',
        headerName: 'Priority',
        width: 12 * remSize,
        renderCell: ({ row }) => <PriorityBadge priority={row.priority} />,
      },
      {
        field: 'dueDate',
        headerName: 'Due date',
        width: 18 * remSize,
        renderCell: ({ row }) => <DueDateLabel date={row.dueDate} />,
      },
    ];
    const custom: GridColDef<Task>[] = fields.map((field) => ({
      field: `custom:${field.key}`,
      headerName: field.name,
      width: 18 * remSize,
      valueGetter: (_value, row) => row.customFields[field.key],
      renderHeader: () => (
        <Stack spacing={0.2}>
          <Typography sx={{ fontWeight: 600 }} variant="body2">
            {field.name}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {field.isInherited ? 'Inherited' : 'Local'}
          </Typography>
        </Stack>
      ),
      renderCell: ({ row }) => (
        <CustomFieldChip field={field} value={row.customFields[field.key]} />
      ),
    }));

    return [...fixed, ...custom].map((column) => ({
      ...column,
      sortable: false,
      filterable: false,
    }));
  }, [fields, onOpenTask, remSize, statuses]);

  return (
    <Container role="region" aria-label="Scrollable task list">
      <RemMeasure ref={remRef} aria-hidden="true" />
      <Grid
        aria-label="List tasks"
        rows={items}
        columns={columns}
        columnHeaderHeight={6.4 * remSize}
        getRowHeight={autoRowHeight}
        getEstimatedRowHeight={estimateRowHeight}
        initialState={initialState}
        pageSizeOptions={pageSizeOptions}
        disableColumnFilter
        disableColumnMenu
        disableColumnSelector
        disableRowSelectionOnClick
      />
    </Container>
  );
}
