'use client';

import { Box, Button, Paper, Stack, Typography } from '@flowboard/ui';
import { ConfirmDialog, KanbanCard, KanbanColumn, TreeItem } from '@flowboard/ui';
import { useState } from 'react';

export function InteractionExamples() {
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2.4, minWidth: 0 }}>
      <Typography component="h2" variant="h3">
        Tree, card and confirmation
      </Typography>
      <Typography color="text.secondary" sx={{ my: 1.2 }}>
        Keyboard controls change this local preview only.
      </Typography>
      <Stack spacing={2}>
        <Box component="ul" aria-label="Example navigation" sx={{ p: 0, m: 0 }}>
          <TreeItem
            name="Example space"
            type="space"
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            onSelect={() => setNotice('Selected Example space')}
          >
            <TreeItem
              name="Example list"
              type="list"
              selected={selected}
              onSelect={() => {
                setSelected(true);
                setNotice('Selected Example list');
              }}
            />
          </TreeItem>
        </Box>
        <KanbanColumn
          status={{ name: 'Doing', category: 'active', color: '#245CC5' }}
          count={1}
          action={<Button onClick={() => setNotice('Add task action selected')}>Add task</Button>}
        >
          <KanbanCard
            task={{
              id: '20000000-0000-4000-8000-000000000200',
              title: 'Review the release notes',
              assignees: [],
              dueDate: '2026-10-30',
              priority: 'normal',
            }}
            onOpen={() => setNotice('Open task action selected')}
            actions={<Button onClick={() => setConfirm(true)}>Move example card</Button>}
          />
        </KanbanColumn>
        {notice && <Typography role="status">{notice}</Typography>}
      </Stack>
      <ConfirmDialog
        open={confirm}
        title="Move this example card?"
        description="This changes only the local preview. No task is saved."
        confirmLabel="Move card"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          setNotice('Move card action confirmed');
        }}
      />
    </Paper>
  );
}
