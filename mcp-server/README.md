# True Recall MCP server

The server talks to the desktop-only Local API exposed by the Obsidian plugin.
Enable it under **Settings → True Recall → Integrations → Local API**, then copy
the generated token and start the MCP process with:

```sh
TRUE_RECALL_TOKEN="<token from Obsidian>" bun mcp-server/index.ts
```

Use `TRUE_RECALL_PORT` as well when the configured port is not `27182`. The API
listens only on `127.0.0.1`, requires authentication for every request, and does
not allow raw SQL unless that separate setting is enabled.

## Persistent local edit events (CLI and MCP)

`list_card_edits` and `get_card_edit_history` read actual before/after events,
with timestamp and exact `manual`/`ai`/`system` attribution. They do **not** require
the SQL endpoint. The latter takes `--card-id`; both support `--edit-source`,
`--source-uid`, `--since`, `--until`, `--limit` (1–200) and `--offset`.

```sh
bun cli/index.ts list_card_edits --edit-source ai --since 2026-10-10 --pretty
bun cli/index.ts get_card_edit_history --card-id <id> --pretty
```

History is local only: newest 50 events per owning note (shared by sibling cards),
10,000 globally, 90 days. No preinstallation history is available. Saved fields
are authoritative; saved templates reconstruct historical Q/A, current text is
returned separately. See [scope, retention and exclusions](./CARD-EDIT-HISTORY.md).

## Edited-card audit (CLI and MCP)

`list_edited_cards` is read-only and uses the existing SQL query and `get_card`
endpoints; it requires **Enable SQL query endpoint** and never enables it for you.
For example, from the repository:

```sh
bun cli/index.ts list_edited_cards --since 2026-10-10 --until 2026-10-17 --pretty
# Installed CLI: true-recall list_edited_cards --since 2026-10-10 --pretty
```

The response includes current rendered question/answer (including reversed and
cloze cards), `editCount`, `aiEditCount`, `contentEditedAt` (epoch milliseconds),
`edited`, `manuallyEdited`, and `aiEdited`. `total`, `count`, `offset` and `hasMore` support
pagination with `--limit` (default 50, max 200) and `--offset` (default 0).
Results sort by last content edit descending, then card ID ascending. Suspended
cards and cards from archived source notes are included; deleted cards and notes
are excluded. `--source-uid` optionally restricts the source note.

`--since` is inclusive; `--until` is exclusive. Each accepts `YYYY-MM-DD` (midnight
in the CLI/MCP process's local timezone) or an ISO datetime with an explicit
`Z`/offset. Omitted bounds are open. Invalid calendar dates and `until <= since`
are rejected before any API call.

**Limitations:** counters are lifetime totals on the underlying note, shared by
sibling cards, and the timestamp records only the last **manual or AI** content
edit. `--manual-only` means lifetime `editCount > 0` plus the last **any** content
edit in the date window; it does **not** prove a manual edit happened in that
window. `--ai-only` similarly requires lifetime `aiEditCount > 0`, including cards
also edited manually; combining both filters requires both counters to be positive.
Neither filter identifies the source of edits within the date window.
This returns current text, not before/after history. Card text is fetched
after the SQL selection and may change during the request; any lookup failure
fails the entire command instead of silently dropping a card.
