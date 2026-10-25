'use client';

import {
  AssigneeAvatarGroup,
  Box,
  Button,
  CustomFieldChip,
  DueDateLabel,
  EmptyState,
  ErrorState,
  PriorityBadge,
  Stack,
  StatusChip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useThemeMode,
} from '@flowboard/ui';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { CompactControlsExample } from './CompactControlsExample';
import { CompositionExamples } from './CompositionExamples';
import { FieldPreviewExample } from './FieldPreviewExample';
import { FormExamples } from './FormExamples';
import { InteractionExamples } from './InteractionExamples';
import { PlaygroundSection } from './PlaygroundSection';
import { StatusPreviewExample } from './StatusPreviewExample';

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
        <PlaygroundSection
          description="Try required number and checkbox controls, including zero and false."
          title="Field configuration previews"
        >
          <FieldPreviewExample />
        </PlaygroundSection>
        <PlaygroundSection
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
        </PlaygroundSection>
        <PlaygroundSection
          description="Presentational examples of an effective set and a rejected draft."
          title="Status configuration previews"
        >
          <StatusPreviewExample />
        </PlaygroundSection>
        <PlaygroundSection
          title="Priority"
          description="All five levels have a text label as well as a color cue."
        >
          <Stack direction="row" useFlexGap spacing={0.8} sx={{ flexWrap: 'wrap' }}>
            {(['urgent', 'high', 'normal', 'low', 'none'] as const).map((priority) => (
              <PriorityBadge key={priority} priority={priority} />
            ))}
          </Stack>
        </PlaygroundSection>
        <PlaygroundSection
          title="Assignees"
          description="The full team remains accessible when avatars overflow."
        >
          <Stack spacing={1.6} sx={{ alignItems: 'flex-start' }}>
            <AssigneeAvatarGroup assignees={assignees} />
            <AssigneeAvatarGroup assignees={[]} />
          </Stack>
        </PlaygroundSection>
        <PlaygroundSection
          description="Calendar days stay stable across time zones."
          title="Due dates"
        >
          <Stack spacing={1.2}>
            <DueDateLabel date="2026-01-01T00:00:00.000Z" />
            <DueDateLabel date="2024-02-29T00:00:00.000Z" overdue />
            <DueDateLabel date={null} />
          </Stack>
        </PlaygroundSection>
        <PlaygroundSection
          title="Custom fields"
          description="Six field types, including meaningful zero and false values."
        >
          <Stack direction="row" useFlexGap spacing={0.8} sx={{ flexWrap: 'wrap' }}>
            {fields.map((props) => (
              <CustomFieldChip key={props.field.name} {...props} />
            ))}
          </Stack>
        </PlaygroundSection>
        <PlaygroundSection
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
        </PlaygroundSection>
        <CompositionExamples />
        <CompactControlsExample />
        <FormExamples />
        <InteractionExamples />
      </Box>
    </Box>
  );
}
