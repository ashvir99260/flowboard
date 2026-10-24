'use client';

import { styled } from '@mui/material/styles';

import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '../primitives.js';

import { AssigneeAvatarGroup } from './assignee-avatar-group.js';
import { CustomFieldChip } from './custom-field-chip.js';
import { DueDateLabel } from './due-date-label.js';
import { PriorityBadge } from './priority-badge.js';
import { StatusChip } from './status-chip.js';

import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';

const Scroll = styled(TableContainer)({
  minWidth: 0,
  maxWidth: '100%',
  overflowX: 'auto',
}) as typeof TableContainer;
const Grid = styled(Table)({
  minWidth: 960,
  overflowWrap: 'normal',
  '& td': { whiteSpace: 'nowrap' },
}) as typeof Table;
const TitleCell = styled(TableCell)({
  minWidth: 220,
  maxWidth: 360,
  overflowWrap: 'anywhere',
}) as typeof TableCell;
const OpenButton = styled(Button)({
  textAlign: 'left',
  justifyContent: 'flex-start',
  overflowWrap: 'anywhere',
}) as typeof Button;
const ValueCell = styled(TableCell)({ minWidth: 140 }) as typeof TableCell;

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
  const statusById = new Map(statuses.map((status) => [status.id, status]));

  return (
    <Scroll component={Box} role="region" aria-label="Scrollable task list" tabIndex={0}>
      <Grid aria-label="List tasks" size="small">
        <TableHead>
          <TableRow>
            {['Title', 'Status', 'Assignees', 'Priority', 'Due date'].map((label) => (
              <TableCell key={label} scope="col">
                {label}
              </TableCell>
            ))}
            {fields.map((field) => (
              <TableCell key={field.id} scope="col">
                {field.name}
                <Typography
                  color="text.secondary"
                  component="span"
                  sx={{ display: 'block' }}
                  variant="caption"
                >
                  {field.isInherited ? 'Inherited' : 'Local'}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((task) => (
            <TableRow key={task.id}>
              <TitleCell component="th" aria-label={task.title} scope="row">
                <OpenButton
                  data-open-task={task.id}
                  aria-label={`Open task: ${task.title}`}
                  onClick={() => onOpenTask(task.id)}
                >
                  {task.title}
                </OpenButton>
              </TitleCell>
              <TableCell>
                <StatusChip status={statusById.get(task.statusId)!} />
              </TableCell>
              <TableCell>
                <AssigneeAvatarGroup assignees={task.assignees} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={task.priority} />
              </TableCell>
              <ValueCell>
                <DueDateLabel date={task.dueDate} />
              </ValueCell>
              {fields.map((field) => (
                <ValueCell key={field.id}>
                  <CustomFieldChip field={field} value={task.customFields[field.key]} />
                </ValueCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Grid>
    </Scroll>
  );
}
