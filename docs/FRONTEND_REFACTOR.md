# Frontend hooks and source naming

R164–R165 refine frontend organization without changing API contracts or product behavior.

## Mutation ownership

All ordinary TanStack mutations in web use one typed `useApiMutation` hook. It preserves the caller's mutation key, variables, callbacks, return/error types and context while applying the existing non-retrying, immediate network policy. Feature hooks retain generated operations, input/output validation, concurrency checks, cache updates, optimistic state and notification ownership. A common hook must not turn invalid responses into successful saves or replay a failed write automatically.

Use `use<Operation>Mutation` for endpoint/grouped-write hook exports, parallel to query naming. Cohesive command groups may remain one hook when they deliberately share concurrency keys and validation. Session login/refresh/logout continue through the coordinated client session runtime.

## File ownership and naming

- React component implementation files use PascalCase matching the main component (`TaskForm.tsx`, `WorkspaceActions.tsx`). Split independently named React components into their own files within the existing feature/module. Cohesive private styled slots and render callbacks stay with their owner.
- Hooks and utility implementation files use camelCase (`useTaskWriteMutation.ts`, `taskFormData.ts`). Keep functions and hook exports camelCase.
- Next.js reserved route filenames, public package exports, wire/API names, test/story/config conventions and backend source names remain unchanged.
- Move shared contexts to a small camelCase context module when needed to avoid circular component imports. Preserve provider identity, state lifetime, dirty drafts and mounted editor behavior.
- Update static imports/exports, dynamic imports, tests, stories, tooling references and documentation together. Do not retain compatibility files that duplicate implementations merely to preserve internal filenames.

## Ordered delivery

1. P33-01: introduce typed mutation execution policy and migrate existing mutation hooks without changing their keys/results.
2. P33-02: split distinct frontend component implementations while retaining shared state/context behavior.
3. P33-03: apply frontend file/symbol names atomically, update references and executable source-boundary rules.

Add regression coverage for callback/type preservation, no automatic retries, mutation ownership, unique component files and filename/import consistency. Record executed and unrun checks separately.
