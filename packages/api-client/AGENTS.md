# API client instructions

Follow root/package rules and the [frontend guide](../../docs/FRONTEND_GUIDELINES.md).

`src/generated` is committed generator output; never hand-edit it. Generate from the committed OpenAPI document with the existing Hey API/TanStack configuration and verify drift. Public exports include the SDK, types, query/mutation options and authored session transport (`setupClient`, `ClientSessionError`).

Auth/session transport customizations belong in `setup-client.ts` and its focused support modules. Preserve cookie credentials, refresh rotation, one retry, cross-tab coordination and rejection of stale responses. Do not store access tokens in localStorage, log credentials or add domain endpoint implementations. UI notifications belong in web, not HTTP interceptors.
