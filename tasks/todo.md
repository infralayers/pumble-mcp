# Task List: Pumble MCP Server

## Task 1: Scaffold project

**Description:** Set up the Node/TypeScript project skeleton: package.json
with scripts (`build`, `dev`, `typecheck`, `test`), tsconfig.json,
dependencies (`@modelcontextprotocol/sdk`, `zod`, dev: `typescript`,
`vitest`, `tsx`/`ts-node`), `.env.example` with `PUMBLE_API_KEY=`, and
`.gitignore` (node_modules, dist, .env).

**Acceptance criteria:**
- [x] `npm install` completes without errors
- [x] `npm run typecheck` runs (even against an empty `src/index.ts` stub)
- [x] `.env` is gitignored; `.env.example` documents `PUMBLE_API_KEY`

**Verification:**
- [x] `npm install && npm run typecheck`
- [x] `git status` (once repo is git-initialized) shows no `.env`, `node_modules`, or `dist` tracked

**Dependencies:** None

**Files likely touched:**
- `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `src/index.ts` (stub)

**Estimated scope:** Small: 1-2 files

---

## Task 2: `pumbleClient.ts` — shared request helper

**Description:** Implement `pumbleRequest<T>(path, init)` per the spec's code
style: builds the URL against `https://pumble-api-keys.addons.marketplace.cake.com`,
adds `ApiKey` header + `Content-Type: application/json`, supports GET query
params and POST bodies, throws with the raw response body text on non-200.

**Acceptance criteria:**
- [x] Correct URL/method/headers built for both GET-with-query and POST-with-body calls
- [x] Non-200 response throws an `Error` whose message includes the response body text
- [x] `PUMBLE_API_KEY` read once from env; missing key throws a clear error at client construction, not deep inside a call

**Verification:**
- [x] `npm test -- pumbleClient` passes against mocked `global.fetch`
- [x] `npm run typecheck` passes

**Dependencies:** Task 1

**Files likely touched:**
- `src/pumbleClient.ts`, `tests/pumbleClient.test.ts`

**Estimated scope:** Small: 1-2 files

---

## Checkpoint: Foundation
- [x] `npm install` succeeds
- [x] `npm run typecheck` passes
- [x] `pumbleClient.test.ts` passes

---

## Task 3: `pumble_send_message` tool

**Description:** Implement the tool wrapping `POST /sendMessage`. Zod input
schema: `channel` (string, optional), `channelId` (string, optional), `text`
(string, required), `asBot` (boolean, optional, default false). Validate
exactly one of `channel`/`channelId` is present before calling Pumble.

**Acceptance criteria:**
- [x] Rejects input with neither or both of `channel`/`channelId` set
- [x] Calls `POST /sendMessage` with the right body shape
- [x] Returns Pumble's response (message id) to the caller

**Verification:**
- [x] `npm test -- sendMessage` passes (validation + happy path, mocked fetch)
- [x] `npm run typecheck` passes

**Dependencies:** Task 2

**Files likely touched:**
- `src/tools/sendMessage.ts`, `tests/tools/sendMessage.test.ts`

**Estimated scope:** Small: 1-2 files

---

## Task 4: `pumble_list_channels` tool

**Description:** Implement the tool wrapping `GET /listChannels`. No input.
Returns the array of `{ channel: {...} }` objects as-is (id, name,
channelType, isMember, etc.) so Claude can resolve `general`'s id/name.

**Acceptance criteria:**
- [x] Calls `GET /listChannels` with no params
- [x] Returns the parsed array unmodified

**Verification:**
- [x] `npm test -- listChannels` passes (mocked fetch)
- [x] `npm run typecheck` passes

**Dependencies:** Task 2

**Files likely touched:**
- `src/tools/listChannels.ts`, `tests/tools/listChannels.test.ts`

**Estimated scope:** Small: 1-2 files

---

## Task 5: `pumble_list_messages` tool

**Description:** Implement the tool wrapping `GET /listMessages`. Zod schema:
`channel`/`channelId` (XOR, same as Task 3), `cursor` (optional string),
`limit` (optional number). Passes through as query params.

**Acceptance criteria:**
- [x] Rejects input with neither or both of `channel`/`channelId` set
- [x] Builds correct query string including optional `cursor`/`limit`
- [x] Returns Pumble's message array to the caller

**Verification:**
- [x] `npm test -- listMessages` passes (mocked fetch)
- [x] `npm run typecheck` passes

**Dependencies:** Task 2

**Files likely touched:**
- `src/tools/listMessages.ts`, `tests/tools/listMessages.test.ts`

**Estimated scope:** Small: 1-2 files

---

## Task 6: `pumble_edit_message` tool

**Description:** Implement the tool wrapping `POST /editMessage`. Zod
schema: `messageId` (string, required), `channelId` (string, required),
`text` (string, required).

**Acceptance criteria:**
- [x] Calls `POST /editMessage` with the right body shape
- [x] Surfaces the `error` field from a 403 response verbatim on failure

**Verification:**
- [x] `npm test -- editMessage` passes (happy path + 403 error case, mocked fetch)
- [x] `npm run typecheck` passes

**Dependencies:** Task 2

**Files likely touched:**
- `src/tools/editMessage.ts`, `tests/tools/editMessage.test.ts`

**Estimated scope:** Small: 1-2 files

---

## Checkpoint: Core Tools
- [x] `npm test` passes for all four tools
- [x] `npm run build` produces `dist/`
- [x] Review tool names/schemas with the maintainer before Phase 3

---

## Task 7: `src/index.ts` entrypoint

**Description:** Wire up the MCP server: instantiate `Server` from
`@modelcontextprotocol/sdk`, register all four tools with their Zod input
schemas, connect stdio transport. Load `PUMBLE_API_KEY` from env at startup
with a clear, immediate error if it's missing (fail fast, not on first
tool call).

**Acceptance criteria:**
- [x] `node dist/index.js` starts without error when `PUMBLE_API_KEY` is set
- [x] Missing `PUMBLE_API_KEY` produces a clear startup error, not a silent hang or cryptic failure inside a tool call
- [x] All four tools are listed when queried over the MCP stdio protocol

**Verification:**
- [x] `npm run build && PUMBLE_API_KEY=test node dist/index.js` starts cleanly (manual check, Ctrl+C to stop)
- [x] `npm run typecheck` passes

**Dependencies:** Tasks 3, 4, 5, 6

**Files likely touched:**
- `src/index.ts`

**Estimated scope:** Small: 1-2 files

---

## Task 8: README

**Description:** Document: how to install the Pumble API Key addon and
generate a key, how to set `PUMBLE_API_KEY` in `.env`, and the exact Claude
Code MCP config snippet (matching how the Slack plugin is registered) to
add this server.

**Acceptance criteria:**
- [x] A newcomer could follow the README start-to-finish to get the server registered in Claude Code
- [x] Config snippet is copy-pasteable, correct path to `dist/index.js`

**Verification:**
- [x] Manual read-through for completeness

**Dependencies:** Task 7

**Files likely touched:**
- `README.md`

**Estimated scope:** Small: 1 file

---

## Task 9: Manual smoke test (general channel)

**Description:** With the server registered in Claude Code, drive the real
flow: `pumble_list_channels` to find `general`'s id, `pumble_send_message`
(asBot: false — posts as the maintainer) into it, `pumble_list_messages` to confirm
it shows up, `pumble_edit_message` to change its text, `pumble_list_messages`
again to confirm the edit landed.

**Acceptance criteria:**
- [x] Message appears in `general` under the maintainer's own name (not a bot identity)
- [x] Edited text is reflected on re-list
- [x] No errors surfaced from any of the four tools during the flow

**Verification:**
- [x] Manual check in the actual Pumble workspace UI, cross-referenced with tool output

**Dependencies:** Task 8

**Files likely touched:** None (manual verification only)

**Estimated scope:** Small

---

## Checkpoint: Complete
- [x] All four tools work end-to-end against real Pumble
- [x] `npm run build && npm test` clean
- [x] Claude Code can see and call all four tools after registration
- [x] Ready for the maintainer's review
