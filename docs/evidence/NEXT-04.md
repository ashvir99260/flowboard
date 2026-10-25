# NEXT-04 Atomic bulk task updates

State: implementation complete; final verification pending.

Added typed PATCH /v1/tasks with bounded unique targets, per-task revisions and one shared patch. Permissions and ordinary task validation run in one workspace transaction. Added DataGrid selection, captured revisions, generated mutation, response validation and one outcome toast. Contract/REST/UI/browser tests and a story are authored. OpenAPI/client generation passed; tests are not_run and final validation remains pending.
