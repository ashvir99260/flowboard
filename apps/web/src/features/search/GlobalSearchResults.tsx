'use client';

import { SearchWorkspaceQuerySchema } from '@flowboard/contracts';
import { useZodForm } from '@flowboard/forms';
import {
  Autocomplete,
  Box,
  Button,
  ErrorState,
  Stack,
  TextField,
  Typography,
  WorkspaceIcon,
} from '@flowboard/ui';
import { useState } from 'react';
import { useController } from 'react-hook-form';
import { z } from 'zod';

import { apiError } from '../../lib/apiError';

import { useSearchWorkspaceInfiniteQuery } from './useSearchWorkspaceInfiniteQuery';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { SearchHit } from '@flowboard/contracts';

const SearchFormSchema = z.strictObject({ q: SearchWorkspaceQuerySchema.shape.q });

export function GlobalSearchResults({
  runtime,
  scope,
  onSelect,
}: {
  onSelect: (hit: SearchHit) => void;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const [submitted, setSubmitted] = useState({ attempt: 0, q: '' });
  const [open, setOpen] = useState(false);
  const { control, handleSubmit } = useZodForm(SearchFormSchema, { defaultValues: { q: '' } });
  const { field, fieldState } = useController({ control, name: 'q' });
  const query = useSearchWorkspaceInfiniteQuery({ ...submitted, runtime, scope });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const search = handleSubmit(({ q }) => {
    setSubmitted((current) => ({ q, attempt: current.attempt + 1 }));
    setOpen(true);
  });

  return (
    <Stack spacing={1.6}>
      <Stack
        component="form"
        noValidate
        direction="row"
        spacing={0.8}
        onSubmit={search}
        sx={{ alignItems: 'flex-start' }}
      >
        <Autocomplete<SearchHit, false, false, true>
          disablePortal
          filterOptions={(options) => options}
          freeSolo
          fullWidth
          getOptionKey={(option) =>
            typeof option === 'string' ? option : `${option.type}:${option.id}`
          }
          getOptionLabel={(option) => (typeof option === 'string' ? option : option.title)}
          inputValue={field.value}
          loading={query.isFetching}
          loadingText="Searching your workspace…"
          noOptionsText="No results"
          onChange={(_event, value) => {
            if (value && typeof value !== 'string') onSelect(value);
          }}
          onClose={() => setOpen(false)}
          onInputChange={(_event, value, reason) => {
            if (reason === 'input' || reason === 'clear') {
              field.onChange(value);
              setSubmitted((current) => ({ ...current, q: '' }));
            }
          }}
          onOpen={() => setOpen(true)}
          open={open && Boolean(submitted.q) && !query.isError}
          options={items}
          slotProps={{
            popper: {
              sx: {
                position: 'static !important',
                transform: 'none !important',
                width: '100% !important',
              },
            },
          }}
          value={null}
          renderInput={(params) => (
            <TextField
              {...params}
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message}
              inputRef={field.ref}
              label="Search tasks and lists"
              name={field.name}
              onBlur={field.onBlur}
              required
            />
          )}
          renderOption={(props, hit) => (
            <li
              {...props}
              key={`${hit.type}:${hit.id}`}
              aria-label={`Open ${hit.type}: ${hit.title}`}
            >
              <WorkspaceIcon name={hit.type === 'task' ? 'check' : 'list'} />
              <Box sx={{ minWidth: 0, ml: 1.2 }}>
                <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {hit.title}
                </Typography>
                <Typography color="text.secondary" variant="caption">
                  {hit.type === 'task' ? 'Task' : 'List'} · {hit.path.join(' / ')}
                </Typography>
              </Box>
            </li>
          )}
        />
        <Button type="submit" variant="contained">
          Search
        </Button>
      </Stack>
      {!submitted.q && (
        <Typography color="text.secondary">
          Find tasks and lists across your workspace. Search by word or quoted phrase.
        </Typography>
      )}
      {submitted.q && query.isError && (
        <ErrorState
          title="Search unavailable"
          description={apiError(query.error).message}
          action={
            <Button
              onClick={() => {
                void query.refetch();
              }}
            >
              Retry search
            </Button>
          }
        />
      )}
      {submitted.q && query.isSuccess && (
        <Typography color="text.secondary" role="status" variant="caption">
          {items.length
            ? `${items.length} results${query.hasNextPage ? ' loaded' : ''}`
            : 'No results'}
        </Typography>
      )}
      {query.hasNextPage && (
        <Button
          disabled={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
            setOpen(true);
          }}
        >
          {query.isFetchingNextPage ? 'Loading results…' : 'Load more results'}
        </Button>
      )}
    </Stack>
  );
}
