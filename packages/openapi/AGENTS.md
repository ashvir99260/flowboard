# OpenAPI instructions

Follow root/package rules and the [backend contract guide](../../docs/BACKEND_CONTRACTS.md).

This is the documented build-only exception that may import the API spec entry. Spec export uses the actual controller registry with isolated providers and no database, Redis connection or listener. Keep /v1 conventions, operation IDs, typed success/errors, cursor envelopes and synthetic schema-valid examples.

Regenerate from schemas/DTOs; do not patch openapi.json manually. Run Spectral, spec drift and generated-client checks when REST changes. Never include real tokens, credentials or deployment secrets in examples.
