# Implementation Plan: Pumble MCP Server

## Overview

Build a local MCP server (Node/TypeScript, stdio transport) that wraps
Pumble's API-key REST addon and exposes four tools to Claude Code:
`pumble_send_message`, `pumble_list_messages`, `pumble_edit_message`,
`pumble_list_channels`. Full details in `../SPEC.md`.

## Architecture Decisions

- **Plain `fetch` over `pumble-node-sdk`** — the SDK targets full OAuth2
  Pumble Apps; we only need the API-key addon's flat REST surface. One
  shared `pumbleRequest()` helper handles the `ApiKey` header and error
  surfacing for all four tools — avoids repeating fetch boilerplate per tool.
- **Vertical slice per tool** — each tool (client fn + Zod schema + MCP
  registration + test) ships as one complete, independently testable unit,
  rather than building "all schemas" then "all handlers" then "all tests."
  `sendMessage` goes first since it's needed to produce data for
  `listMessages`/`editMessage` to act on during the manual smoke test.
- **No live Pumble calls in automated tests** — `global.fetch` is mocked;
  the real API is only hit during the manual smoke test task at the end.
- **Env var `PUMBLE_API_KEY`** loaded once at startup, passed into the
  client — never read per-call, never logged.

## Task List

### Phase 1: Foundation

- [ ] Task 1: Scaffold project (package.json, tsconfig, MCP SDK/zod/vitest deps, `.env.example`, gitignore)
- [ ] Task 2: Build `pumbleClient.ts` — shared `pumbleRequest()` fetch wrapper with `ApiKey` header, query/body handling, error surfacing

### Checkpoint: Foundation
- [ ] `npm install` succeeds
- [ ] `npm run typecheck` passes on the empty/stub client
- [ ] `pumbleClient.test.ts` passes against mocked fetch (URL, method, header, error-body assertions)

### Phase 2: Core Tools (vertical slices)

- [ ] Task 3: `pumble_send_message` tool (Zod schema, channel/channelId XOR validation, MCP registration, unit test)
- [ ] Task 4: `pumble_list_channels` tool (no input, MCP registration, unit test) — needed to look up `general`'s channel ID/name before send/list/edit smoke testing
- [ ] Task 5: `pumble_list_messages` tool (channel/channelId XOR, cursor/limit passthrough, MCP registration, unit test)
- [ ] Task 6: `pumble_edit_message` tool (messageId+channelId+text, MCP registration, unit test)

### Checkpoint: Core Tools
- [ ] `npm test` passes for all four tools
- [ ] `npm run build` produces `dist/index.js` with all tools registered
- [ ] Review tool names/schemas with the maintainer before wiring into Claude Code config

### Phase 3: Integration & Polish

- [ ] Task 7: Wire `src/index.ts` entrypoint — register all four tools on the MCP server, stdio transport, load `PUMBLE_API_KEY` from env with a clear startup error if missing
- [ ] Task 8: README — how to generate the Pumble API key, `.env` setup, exact Claude Code MCP config snippet to register the server
- [ ] Task 9: Manual smoke test against the real `general` channel — send a message (as self, `asBot: false`), list channels to confirm channel resolution, list messages to see it, edit it, list again to confirm the edit

### Checkpoint: Complete
- [ ] All four tools work end-to-end against real Pumble in the smoke test
- [ ] `npm run build && npm test` clean
- [ ] Claude Code can see and call all four tools after registration
- [ ] Ready for the maintainer's review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pumble API key lacks permission on `general` (private channel, bot not a member) | Med | Task 4 (`list_channels`) run first in the smoke test to confirm visibility before send/edit |
| `channel` name lookup ambiguity (duplicate names) vs `channelId` | Low | Prefer resolving and using `channelId` explicitly once `list_channels` gives us the general channel's ID |
| MCP SDK stdio registration quirks (first time using this exact SDK in this env) | Med | Keep Task 7 isolated as its own task with a trivial manual `node dist/index.js` smoke check before the Pumble-specific smoke test |
| Rate limit (1000 req/min) irrelevant at this usage scale | Low | No mitigation needed, noted for completeness |

## Open Questions

None outstanding — smoke test channel (`general`) and `asBot: false`
(send as the maintainer's own user) are both confirmed in `../SPEC.md`.
