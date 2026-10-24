'use client';

import {
  Box,
  Button,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@flowboard/ui';
import {
  AssigneeAvatarGroup,
  CustomFieldChip,
  DueDateLabel,
  EmptyState,
  ErrorState,
  PriorityBadge,
  StatusChip,
  useThemeMode,
} from '@flowboard/ui';
import { useState } from 'react';

import { CompositionExamples } from './composition-examples';
import { FieldPreviewExample } from './field-preview-example';
import { FormExamples } from './form-examples';
import { InteractionExamples } from './interaction-examples';
import { StatusPreviewExample } from './status-preview-example';

import type { ComponentProps, ReactNode } from 'react';

const options = [
  { id: 'design', label: 'Design', color: '#245CC5' },
  { id: 'platform', label: 'Platform', color: '#146C43' },
];
const fields: Array<ComponentProps<typeof CustomFieldChip>> = [
  { field: { name: 'Effort', type: 'number', options: [] }, value: 0 },
  { field: { name: 'Approved', type: 'checkbox', options: [] }, value: false },
  { field: { name: 'Team', type: 'single_select', options }, value: 'platform' },
  { field: { name: 'Teams', type: 'multi_select', options }, value: ['design', 'platform'] },
  { field: { name: 'Release', type: 'date', options: [] }, value: '2026-01-01' },
  {
    field: { name: 'Notes', type: 'text', options: [] },
    value:
      'Review the international release plan with design and engineering before the next milestone.',
  },
];
const assignees = ['Élodie Rivera', 'Bob Jones', 'Carol Wu', 'Dana Kim', 'Evan Li'].map(
  (name, index) => ({ id: String(index), name }),
);

function Section({
  children,
  description,
  title,
}: Readonly<{ children: ReactNode; description: string; title: string }>) {
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2.4, minWidth: 0, borderRadius: 2 }}>
      <Typography component="h2" variant="h3">
        {title}
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.4, mb: 2 }}>
        {description}
      </Typography>
      {children}
    </Paper>
  );
}

export function Playground() {
  const { mode, setMode } = useThemeMode();
  const [notice, setNotice] = useState('');

  return (
    <Box component="main" sx={{ maxWidth: '112rem', mx: 'auto', p: { xs: 1.6, md: 3.2 } }}>
      <Stack
        direction="row"
        useFlexGap
        spacing={1.6}
        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 3.2 }}
      >
        <Box>
          <Typography variant="body2" color="primary" sx={{ fontWeight: 650, mb: 0.8 }}>
            FLOWBOARD / UI LIBRARY
          </Typography>
          <Typography component="h1" variant="h1">
            Component playground
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.8 }}>
            Development only. Sample props, no API data.
          </Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          value={mode ?? 'light'}
          aria-label="Appearance"
          onChange={(_event, value: 'light' | 'dark' | null) => {
            if (value) setMode(value);
          }}
        >
          <ToggleButton value="light" aria-label="Light theme" sx={{ minHeight: '4.4rem' }}>
            Light
          </ToggleButton>
          <ToggleButton value="dark" aria-label="Dark theme" sx={{ minHeight: '4.4rem' }}>
            Dark
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        <Section
          description="Try required number and checkbox controls, including zero and false."
          title="Field configuration previews"
        >
          <FieldPreviewExample />
        </Section>
        <Section
          title="Status"
          description="Names and categories remain readable with any accent color."
        >
          <Stack direction="row" useFlexGap spacing={0.8} sx={{ flexWrap: 'wrap' }}>
            <StatusChip status={{ name: 'Backlog', category: 'not_started', color: '#FFFFFF' }} />
            <StatusChip status={{ name: 'In progress', category: 'active', color: '#245CC5' }} />
            <StatusChip status={{ name: 'Complete', category: 'done', color: '#146C43' }} />
            <StatusChip status={{ name: 'Closed', category: 'closed', color: '#65738B' }} />
            <StatusChip
              status={{
                name: 'Awaiting stakeholder review after the international release readiness discussion',
                category: 'active',
                color: '#B42318',
              }}
            />
          </Stack>
        </Section>
        <Section
          description="Presentational examples of an effective set and a rejected draft."
          title="Status configuration previews"
        >
          <StatusPreviewExample />
        </Section>
        <Section
          title="Priority"
          description="All five levels have a text label as well as a color cue."
        >
          <Stack direction="row" useFlexGap spacing={0.8} sx={{ flexWrap: 'wrap' }}>
            {(['urgent', 'high', 'normal', 'low', 'none'] as const).map((priority) => (
              <PriorityBadge key={priority} priority={priority} />
            ))}
          </Stack>
        </Section>
        <Section
          title="Assignees"
          description="The full team remains accessible when avatars overflow."
        >
          <Stack spacing={1.6} sx={{ alignItems: 'flex-start' }}>
            <AssigneeAvatarGroup assignees={assignees} />
            <AssigneeAvatarGroup assignees={[]} />
          </Stack>
        </Section>
        <Section description="Calendar days stay stable across time zones." title="Due dates">
          <Stack spacing={1.2}>
            <DueDateLabel date="2026-01-01" />
            <DueDateLabel date="2024-02-29" overdue />
            <DueDateLabel date={null} />
          </Stack>
        </Section>
        <Section
          title="Custom fields"
          description="Six field types, including meaningful zero and false values."
        >
          <Stack direction="row" useFlexGap spacing={0.8} sx={{ flexWrap: 'wrap' }}>
            {fields.map((props) => (
              <CustomFieldChip key={props.field.name} {...props} />
            ))}
          </Stack>
        </Section>
        <Section
          title="Empty and error states"
          description="A clear explanation and an accessible next action."
        >
          <Stack spacing={1.6}>
            <EmptyState
              title="No tasks yet"
              description="Your next idea can start here."
              action={
                <Button variant="outlined" onClick={() => setNotice('Sample action selected.')}>
                  Try sample action
                </Button>
              }
            />
            <ErrorState
              title="Unable to load tasks"
              description="Your work is safe. Please try again."
              action={
                <Button
                  color="inherit"
                  onClick={() => setNotice('Sample retry selected. No request sent.')}
                >
                  Retry loading project workspace tasks
                </Button>
              }
            />
            {notice && (
              <Typography role="status" variant="body2">
                {notice}
              </Typography>
            )}
          </Stack>
        </Section>
        <CompositionExamples />
        <FormExamples />
        <InteractionExamples />
      </Box>
    </Box>
  );
}
