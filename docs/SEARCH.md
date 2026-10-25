# Permission-scoped task search

R158 is selected by D155. Search covers a selected list's live task titles and Markdown descriptions through the existing `GET /v1/lists/:listId/tasks` operation. The List view supplies a URL-backed search form; the board retains its existing ordering and drag behavior.

## Contract and matching

Optional `q` is trimmed, 1–200 Unicode code points, and rejects NUL/unpaired surrogates. Omit it to clear search. Whitespace-only input is invalid at the API boundary. The UI treats an empty search box as clearing the parameter.

Use PostgreSQL 17 `to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')) @@ websearch_to_tsquery('simple', q)`. Query values remain SQL parameters. Matching is word based and case insensitive; quoted phrases, OR and minus exclusions use PostgreSQL's web-search syntax. No stemming, fuzzy/substring matching, relevance sorting, custom-field text indexing or global cross-list search is included. A punctuation-only query returns no matches.

## Persistence and access

A partial GIN expression index covers live tasks. It indexes existing data without rewriting task values or audit timestamps. PostgreSQL maintains it in the same transaction as create/edit/archive; moves immediately affect the destination list's scoped results. There is no asynchronous indexing delay or reindex worker. Remove the unused search-index stub when this path lands; BullMQ still owns activity delivery.

Existing tenant and list permission checks remain authoritative. Search predicates run before cursor pagination and combine with existing parent/status/assignee/priority/custom-field filters. Preserve current manual/due-date/priority ordering and ID ties. Include canonical `q` in the cursor fingerprint; changing it requires starting from the first page. Existing revision checks reject stale pages after writes.

## Web behavior and privacy

Search and Clear preserve the selected sort and field filter; changing either preserves search. URLs support reload/back navigation. Reuse generated operations, existing scoped query keys and stale-response rejection; never approximate PostgreSQL search in JavaScript. Keep forms in RHF/Zod and controls in the shared UI package. Empty/error/loading states remain explicit.

API logs retain route templates and exclude query contents. Disable Next's development request URL logging because search terms may contain task content. Browser history intentionally retains a user-shared search URL.

## Delivery and acceptance

- P31-01: contract, parameterized repository predicate/index migration, cursor binding, OpenAPI/client and persistence/API regressions.
- P31-02: URL/search controls, preserving sort/filter, real browser search/clear/reload and privacy regressions.
- Prove Unicode bounds, invalid/blank inputs, title/description/phrase/word matching, combined filters, foreign/private/archive isolation, stale/different-query cursors and write/move/archive/rollback consistency.
- Keep R158 in progress until both implementation and final verification are recorded.

References: PostgreSQL 17 [query parsing](https://www.postgresql.org/docs/17/textsearch-controls.html), [expression indexes](https://www.postgresql.org/docs/17/textsearch-tables.html), and [GIN indexes](https://www.postgresql.org/docs/17/textsearch-indexes.html).
