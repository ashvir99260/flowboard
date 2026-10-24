# Flowboard API walkthrough

Use Bash, curl and jq against the local demo started using the [README](../README.md#run-with-docker). This uses the same REST contracts as the generated browser client. The script creates one scratch task, edits and moves it, observes activity, then archives it. It does not edit existing task contents, but moving a task can normalize sibling positions and update their revisions. Run against a disposable demo if you intend to experiment.

The default API is `http://localhost:3001`; its exact allowed browser Origin is `http://localhost:3000`. Override `FLOWBOARD_API_BASE` and `FLOWBOARD_ORIGIN` together for another local port or an authorized server. Keep the cookie jar private. The public demo credentials below must never be enabled on a hosted production database.

```bash
set -euo pipefail
umask 077
base="${FLOWBOARD_API_BASE:-http://localhost:3001}"
origin="${FLOWBOARD_ORIGIN:-http://localhost:3000}"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
jar="$scratch/cookies"
touch "$jar"
token=''

api() {
  local path="$1"
  shift
  local headers=(-H "Origin: $origin" -H 'Content-Type: application/json')
  if [[ -n "$token" ]]; then
    headers+=(-H "Authorization: Bearer $token")
  fi
  curl --fail-with-body --silent --show-error \
    -b "$jar" -c "$jar" "${headers[@]}" "$base$path" "$@"
}

# Login and rotate the refresh cookie. Never print the token or cookie jar.
api /v1/auth/login --request POST \
  --data '{"email":"alice@example.com","password":"FlowboardDemo123!"}' > "$scratch/session"
token=$(jq -er '.data.accessToken' "$scratch/session")
api /v1/auth/refresh --request POST --data '{}' > "$scratch/session"
token=$(jq -er '.data.accessToken' "$scratch/session")
jq -e '.data.activeWorkspace.name == "Flowboard Demo"' "$scratch/session" > /dev/null

# Tree pages use an opaque cursor and the same page limit throughout.
cursor=''
printf '[]' > "$scratch/nodes"
while :; do
  query=(--get --data-urlencode 'limit=2')
  if [[ -n "$cursor" ]]; then query+=(--data-urlencode "cursor=$cursor"); fi
  api /v1/tree "${query[@]}" > "$scratch/page"
  jq -s '.[0] + .[1].items' "$scratch/nodes" "$scratch/page" > "$scratch/next"
  mv "$scratch/next" "$scratch/nodes"
  cursor=$(jq -r '.pageInfo.nextCursor // empty' "$scratch/page")
  [[ -n "$cursor" ]] || break
done
source_list=$(jq -er '.[] | select(.type == "list" and .name == "Product backlog") | .id' "$scratch/nodes")
destination=$(jq -er '.[] | select(.type == "list" and .name == "Discovery") | .id' "$scratch/nodes")
api "/v1/lists/$source_list/resolved-statuses" > "$scratch/statuses"
api "/v1/lists/$source_list/resolved-fields" > "$scratch/fields"
status=$(jq -er '.items | map(select(.category == "not_started")) | first.id' "$scratch/statuses")
active=$(jq -er '.items | map(select(.category == "active")) | first.id' "$scratch/statuses")
config=$(jq -er '.configVersion' "$scratch/statuses")
jq -e --argjson version "$config" '.configVersion == $version' "$scratch/fields" > /dev/null

# Every create validates the resolved required fields; this seed requires effort.
body=$(jq -nc --arg status "$status" --argjson config "$config" \
  '{title:"Curl walkthrough task",statusId:$status,customFields:{effort:1},expectedConfigVersion:$config}')
api "/v1/lists/$source_list/tasks" --request POST --data "$body" > "$scratch/task"
task=$(jq -er '.data.id' "$scratch/task")

# Read all source-list pages. Do not retain task cursors across later mutations.
cursor=''
while :; do
  query=(--get --data-urlencode 'limit=2')
  if [[ -n "$cursor" ]]; then query+=(--data-urlencode "cursor=$cursor"); fi
  api "/v1/lists/$source_list/tasks" "${query[@]}" > "$scratch/page"
  jq -e '.items | type == "array"' "$scratch/page" > /dev/null
  cursor=$(jq -r '.pageInfo.nextCursor // empty' "$scratch/page")
  [[ -n "$cursor" ]] || break
done

# An invalid field is a real 400 with a field path; the saved task is unchanged.
invalid=$(jq -nc --slurpfile saved "$scratch/task" \
  '{customFields:{effort:"wrong type"},expectedVersion:$saved[0].data.version,expectedConfigVersion:$saved[0].configVersion}')
code=$(curl --silent --show-error -o "$scratch/error" -w '%{http_code}' \
  -b "$jar" -c "$jar" -H "Origin: $origin" -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' --request PATCH --data "$invalid" "$base/v1/tasks/$task")
[[ "$code" == 400 ]]
jq -e '.error.code == "FIELD_VALUE_INVALID" and any(.error.details[]; .path == ["customFields","effort"])' "$scratch/error" > /dev/null

# Version preconditions come from the latest response, never from a local counter.
body=$(jq -nc --arg active "$active" --slurpfile saved "$scratch/task" \
  '{title:"Edited through the API",statusId:$active,customFields:{effort:2},expectedVersion:$saved[0].data.version,expectedConfigVersion:$saved[0].configVersion}')
api "/v1/tasks/$task" --request PATCH --data "$body" > "$scratch/task"
api "/v1/tasks/$task" > "$scratch/read"
jq -e '.data.title == "Edited through the API" and .data.customFields.effort == 2' "$scratch/read" > /dev/null

# This unassigned task has only effort, which is valid in both seeded lists.
# Moving an existing task may also require clearing source-only fields explicitly.
body=$(jq -nc --arg destination "$destination" --slurpfile saved "$scratch/task" \
  '{destinationListId:$destination,placement:{edge:"end"},expectedVersion:$saved[0].data.version,expectedConfigVersion:$saved[0].configVersion}')
api "/v1/tasks/$task/move" --request POST --data "$body" > "$scratch/task"
jq -e --arg destination "$destination" '.data.primaryListId == $destination' "$scratch/task" > /dev/null

# Activity is eventual: PostgreSQL commit precedes the queue/worker write.
for attempt in {1..30}; do
  api "/v1/tasks/$task/activity" --get --data-urlencode 'limit=2' > "$scratch/activity"
  if jq -e '.items | length > 0' "$scratch/activity" > /dev/null; then break; fi
  sleep 1
done
jq -e '.items | length > 0' "$scratch/activity" > /dev/null

# Archive the scratch task and revoke this login session.
body=$(jq -nc --slurpfile saved "$scratch/task" \
  '{expectedVersion:$saved[0].data.version,expectedConfigVersion:$saved[0].configVersion}')
api "/v1/tasks/$task" --request DELETE --data "$body" > /dev/null
api /v1/auth/logout --request POST --data '{}' > /dev/null
token=''
printf 'Walkthrough passed; scratch task archived and session signed out.\n'
```

On `409 VERSION_CONFLICT` or `CONFIG_CONFLICT`, load the current task and resolved configuration, reconcile your intended edit, then submit their new versions. Do not blindly retry an old write. On `CURSOR_STALE`, discard the entire page chain and restart with the same filter/sort/limit. On 401, refresh once with the cookie jar; failure requires login. A 403 is an access decision and must not trigger refresh. Error details are arrays of typed field paths, not text to parse.

For a typed custom-field filter, add `--data-urlencode 'fieldKey=effort' --data-urlencode 'fieldOperator=eq' --data-urlencode 'fieldValue=2'` to the task-page request. `fieldValue` contains JSON: text/select/date values need JSON quotes, numbers and booleans do not. Sort with the documented `sort` value from [the API catalog](../docs/API_CATALOG.md). Cursors are scoped to caller, tenant, resource, query and limit and expire after 15 minutes.

Browser features such as drawers, optimistic drag previews, focus and URL state are UI-only. Permission checks, resolved rules, versions, errors and REST mutations are shared. [Event contracts](../docs/api-events.md) explain the separate worker/socket channel.
