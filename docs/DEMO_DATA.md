# Demo workspace and permission personas

The opt-in fresh seed creates fictional local accounts using real authentication. Password: `FlowboardDemo123!`. Never enable demo seed in a hosted production database. Existing initialized databases are untouched; the README shows a separate fresh preview project.

## Main workspace

| Space       | Folder              | List / board       | Special behavior                                                                         |
| ----------- | ------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| Engineering | Delivery            | Product backlog    | Public; workspace and Engineering/Delivery fields.                                       |
| Engineering | Delivery            | Private launch     | Private; Carol allowed; local Team override and Blocked status.                          |
| Design      | Research            | Discovery          | Bob denied; Closed status hidden; optional Research customer field.                      |
| Operations  | Customer support    | Support triage     | Private Operations ancestor; private list allows Eve; Incoming/Working/Waiting statuses. |
| Operations  | Customer support    | Incident follow-up | Private Operations ancestor; Frank denied at folder; Closed status hidden.               |
| Operations  | Internal operations | Routine operations | Eve and Frank allowed through Operations; Waiting status hidden; Verified checkbox.      |

There are 48 tasks, eight per list. The original 24 retain their IDs, names and field values. New operations tasks describe support triage, incident follow-up and maintenance work; priorities, dates, empty assignments, multiple assignments, numeric zero, checkbox false and multi-select values vary.

## Accounts

| Account           | Role / lists visible in the main workspace                   |
| ----------------- | ------------------------------------------------------------ |
| alice@example.com | Admin; all six lists and all configuration.                  |
| bob@example.com   | Member; Product backlog.                                     |
| carol@example.com | Member; the original three lists.                            |
| eve@example.com   | Member; Product backlog, Discovery and all Operations lists. |
| frank@example.com | Member; Product backlog, Discovery and Routine operations.   |
| dan@example.com   | Admin of Other Tenant; cannot read main-workspace resources. |

Alice also belongs to Other Tenant as a member. Other Tenant retains one space/folder/list and three isolated tasks. Same-workspace denial returns 403; other-tenant identifiers return 404. Eve/Frank do not get configuration administration rights from their grants.

## Fields and resolution

Nine definitions cover seven keys and all six types. Workspace Effort is a required number. Engineering Team is a single-select with a complete local override on Private launch; Delivery supplies Release date. Design supplies optional Research customer text. Operations adds Customer text and Tags multi-select; Customer support requires Severity single-select; Routine operations adds Verified checkbox. All lists inherit at least two effective definitions. Omitted optional values, zero and false are intentional test data.

Statuses retain canonical identities and resolve by key through ancestors. The Operations Waiting status is hidden on Routine operations; Incident follow-up hides Closed. Every resulting list still has not-started, active and done categories. Existing original list status sets remain unchanged.

## Data safety

The whole fresh seed runs in one transaction under the initialization advisory lock. The `demo-v1` marker means initialization already occurred, not that later code may replace that database. Repeated/concurrent boots preserve records, password hashes, grants and audit times. A failed seed inserts neither partial fixtures nor the completion marker. Disabled demo mode migrates without adding demo records.

No upgrade/reset command is introduced. To inspect fresh content use a new named local Compose project as documented in the [README](../README.md#expanded-demo-personas-and-safe-fresh-previews). A future additive upgrade must resolve existing user edits, ID/email collisions, active field schemas and concurrent clients before writing.
