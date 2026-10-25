# NEXT-01 Task search design

State: design recorded; implementation and final checks pending.
Requirement: R158.

Reviewed existing task query schemas, repository SQL, cursor fingerprints, list URL/query state and PostgreSQL 17 documentation. [SEARCH.md](../SEARCH.md) selects list-scoped title/description search, a transactionally maintained GIN expression index, existing permission/cursor boundaries and explicit URL controls. P31-01/P31-02 own implementation and behavioral verification. No functioning search is claimed by this design record.
