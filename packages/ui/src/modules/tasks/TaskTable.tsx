'use client';

import { default as Stack } from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import { default as Typography } from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';
import { useCallback, useMemo, useState } from 'react';

import { useRemSize } from '../../hooks/useRemSize.js';
import { CustomFieldChip } from '../forms/CustomFieldChip.js';
import { Button } from '../primitives/Button.js';

import { AssigneeAvatarGroup } from './AssigneeAvatarGroup.js';
import { DueDateLabel } from './DueDateLabel.js';
import { PriorityBadge } from './PriorityBadge.js';
import { StatusChip } from './StatusChip.js';
import { readTaskFilter, taskFieldColumn, taskFilterModel } from './taskTableControls.js';

import type { TaskTableControls } from './taskTableControls.js';
import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';
import type { GridColDef, GridEventListener, GridSortModel } from '@mui/x-data-grid';

const Container = styled('div')({
  height: 'min(64rem, 75dvh)',
  display: 'flex',
  flexDirection: 'column',
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
  '--DataGrid-t-color-background-base': (theme.vars ?? theme).palette.background.paper,
  '--DataGrid-t-header-background-base': (theme.vars ?? theme).palette.background.paper,
  '--DataGrid-t-color-border-base': (theme.vars ?? theme).palette.divider,
  minWidth: 0,
  width: '100%',
  '& .MuiDataGrid-toolbar': { minHeight: '4.4rem', padding: theme.spacing(0.4, 0.8) },
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
  '& .MuiDataGrid-footerContainer': { minHeight: '5.6rem', flexShrink: 0 },
  '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', paddingInline: theme.spacing(0.8) },
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
  selection,
  controls,
  loading = false,
}: {
  controls?: TaskTableControls;
  fields: readonly ResolvedField[];
  items: readonly Task[];
  loading?: boolean;
  onOpenTask: (id: string) => void;
  selection?: {
    disabled?: boolean;
    ids: readonly string[];
    onChange: (ids: string[]) => void;
  };
  statuses: readonly ResolvedStatus[];
}) {
  const { ref: remRef, size: remSize } = useRemSize();

  const filterSignature = JSON.stringify([
    controls?.filter?.key,
    controls?.filter?.operator,
    controls?.filter?.value,
  ]);

  const [filterDraft, setFilterDraft] = useState(() => ({
    signature: filterSignature,
    model: taskFilterModel(controls?.filter ?? null, fields),
  }));

  if (filterDraft.signature !== filterSignature) {
    const draft = readTaskFilter(filterDraft.model, fields);
    const acknowledged =
      draft.complete &&
      draft.filter?.key === controls?.filter?.key &&
      draft.filter?.operator === controls?.filter?.operator &&
      draft.filter?.value === controls?.filter?.value;
    setFilterDraft({
      signature: filterSignature,
      model: acknowledged ? filterDraft.model : taskFilterModel(controls?.filter ?? null, fields),
    });
  }

  const sortField = controls?.sort?.field;
  const sortDirection = controls?.sort?.direction;

  const sortModel = useMemo<GridSortModel>(
    () => (sortField && sortDirection ? [{ field: sortField, sort: sortDirection }] : []),
    [sortDirection, sortField],
  );
  const estimateRowHeight = useCallback(() => 6.4 * remSize, [remSize]);
  const openRow = useCallback<GridEventListener<'rowClick'>>(
    (params, event) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        event.defaultPrevented ||
        event.defaultMuiPrevented ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        target.closest(
          'button, a, input, select, textarea, label, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="checkbox"], [role="combobox"], [role="switch"]',
        )
      )
        return;

      const item = items.find(({ id }) => id === params.id);
      const row = target.closest('[role="row"]');
      if (!item || !row) return;

      const selection = row.ownerDocument.getSelection();
      if (
        selection &&
        !selection.isCollapsed &&
        Array.from({ length: selection.rangeCount }, (_, index) =>
          selection.getRangeAt(index),
        ).some((range) => range.intersectsNode(row))
      )
        return;

      row.querySelector<HTMLElement>('[data-open-task]')?.focus({ preventScroll: true });
      onOpenTask(item.id);
    },
    [items, onOpenTask],
  );

  const columns = useMemo<GridColDef<Task>[]>(() => {
    const statusById = new Map(statuses.map((status) => [status.id, status]));
    const fixed: GridColDef<Task>[] = [
      {
        field: 'title',
        headerName: 'Title',
        width: 30 * remSize,
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
        renderCell: ({ row }) => <DueDateLabel date={row.dueDate} variant="compact" />,
      },
    ];
    const custom: GridColDef<Task>[] = fields.map((field) => ({
      field: `custom:${field.key}`,
      headerName: field.name,
      width: 18 * remSize,
      ...taskFieldColumn(field),
      valueGetter: (_value, row) => {
        const value = row.customFields[field.key];

        return field.type === 'date' && typeof value === 'string'
          ? new Date(`${value}T00:00:00.000Z`)
          : value;
      },
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

    return [...fixed, ...custom].map((column) => {
      const sortable = Boolean(
        controls && !controls.disabled && ['dueDate', 'priority'].includes(column.field),
      );
      const filterable = Boolean(
        controls && !controls.disabled && column.field.startsWith('custom:'),
      );

      return { ...column, sortable, filterable, disableColumnMenu: !sortable && !filterable };
    });
  }, [controls, fields, onOpenTask, remSize, statuses]);

  return (
    <Container role="region" aria-label="Scrollable task list">
      <RemMeasure ref={remRef} aria-hidden="true" />
      <Grid
        aria-label="List tasks"
        loading={loading}
        localeText={{ noRowsLabel: 'No matching tasks' }}
        rows={items}
        columns={columns}
        columnHeaderHeight={6.4 * remSize}
        getRowHeight={autoRowHeight}
        getEstimatedRowHeight={estimateRowHeight}
        initialState={initialState}
        pageSizeOptions={pageSizeOptions}
        sortingMode="server"
        sortModel={sortModel}
        onSortModelChange={(model) => {
          if (!controls || controls.disabled) return;

          const [sort] = model;
          if (!sort) controls.onSortChange(null);
          else if ((sort.field === 'dueDate' || sort.field === 'priority') && sort.sort)
            controls.onSortChange({ field: sort.field, direction: sort.sort });
        }}
        filterMode="server"
        filterModel={filterDraft.model}
        onFilterModelChange={(model) => {
          if (!controls || controls.disabled) return;

          setFilterDraft({ signature: filterSignature, model });
          const checked = readTaskFilter(model, fields);
          if (
            checked.complete &&
            (checked.filter?.key !== controls.filter?.key ||
              checked.filter?.operator !== controls.filter?.operator ||
              checked.filter?.value !== controls.filter?.value)
          )
            controls.onFilterChange(checked.filter);
        }}
        showToolbar={Boolean(controls && fields.length)}
        slotProps={{
          toolbar: {
            showQuickFilter: false,
            csvOptions: { disableToolbarButton: true },
            printOptions: { disableToolbarButton: true },
          },
          filterPanel: {
            disableAddFilterButton: true,
            sx: {
              width: 'min(56rem, calc(100vw - 3.2rem))',
              '& .MuiDataGrid-filterForm': { flexWrap: 'wrap', gap: '1.2rem' },
              '& .MuiDataGrid-filterFormColumnInput, & .MuiDataGrid-filterFormOperatorInput, & .MuiDataGrid-filterFormValueInput':
                { flex: '1 1 12rem', minWidth: 0 },
            },
          },
        }}
        disableColumnFilter={!controls || controls.disabled}
        disableColumnMenu={!controls || controls.disabled}
        disableColumnSelector
        disableRowSelectionOnClick
        checkboxSelection={Boolean(selection)}
        disableRowSelectionExcludeModel
        keepNonExistentRowsSelected
        rowSelectionModel={selection ? { type: 'include', ids: new Set(selection.ids) } : undefined}
        isRowSelectable={({ id }) =>
          !selection?.disabled &&
          (!selection || selection.ids.includes(String(id)) || selection.ids.length < 50)
        }
        onRowSelectionModelChange={(model) => {
          if (!selection || selection.disabled || model.type !== 'include' || model.ids.size > 50)
            return;

          selection.onChange([...model.ids].map(String));
        }}
        onRowClick={openRow}
      />
    </Container>
  );
}
