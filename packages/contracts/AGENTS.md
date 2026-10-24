# Contracts instructions

Follow the root/package instructions and [naming guide](../../docs/NAMING_CONVENTIONS.md).

Import only Zod and local contract files. Schemas, inferred types, constants and deterministic status/field resolution belong here; Nest, React, Prisma, environment access and I/O do not. Do not duplicate shapes in DTOs or UI types.

Preserve public field/enum/status identities and strict validation. Add title/description/examples when schemas appear in Swagger. Test invalid types, unknown keys, null/omission differences, inheritance and required categories. A contract change requires compatibility review and regeneration when it affects REST; a socket change must preserve supported client/server combinations.
