'use client';

import {
  AssigneeAvatarGroup,
  CustomFieldChip,
  DueDateLabel,
  PriorityBadge,
  StatusChip,
} from '@flowboard/ui';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';

export function TaskTable({
  items,
  fields,
  statuses,
}: {
  fields: readonly ResolvedField[];
  items: readonly Task[];
  statuses: readonly ResolvedStatus[];
}) {
  const statusById = new Map(statuses.map((status) => [status.id, status]));

  return (
    <TableContainer
      component={Box}
      role="region"
      aria-label="Scrollable task list"
      tabIndex={0}
      sx={{ minWidth: 0, maxWidth: '100%', overflowX: 'auto' }}
    >
      <Table
        aria-label="List tasks"
        size="small"
        sx={{ minWidth: 960, overflowWrap: 'normal', '& td': { whiteSpace: 'nowrap' } }}
      >
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
              <TableCell
                component="th"
                scope="row"
                sx={{ minWidth: 220, maxWidth: 360, overflowWrap: 'anywhere' }}
              >
                {task.title}
              </TableCell>
              <TableCell>
                <StatusChip status={statusById.get(task.statusId)!} />
              </TableCell>
              <TableCell>
                <AssigneeAvatarGroup assignees={task.assignees} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={task.priority} />
              </TableCell>
              <TableCell sx={{ minWidth: 140 }}>
                <DueDateLabel date={task.dueDate} />
              </TableCell>
              {fields.map((field) => (
                <TableCell key={field.id} sx={{ minWidth: 140 }}>
                  <CustomFieldChip field={field} value={task.customFields[field.key]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
