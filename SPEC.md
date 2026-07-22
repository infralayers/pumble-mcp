# Spec: Pumble MCP Server

## Objective

Give Claude Code the same kind of send/read/update access to Pumble that it
already has to Slack via the `plugin_slack_slack` MCP plugin. Concretely:
build a small local MCP server that wraps Pumble's official "API Key addon"
REST API, exposing a handful of MCP tools (send message, list channel
messages, edit message, list channels) that Claude Code can call directly.

User: a solo developer, the only consumer of these tools. Success =
Claude can post a message to a Pumble channel, read recent messages back,
and edit a message it (or the API-key user) sent, all via natural-language
requests in a Claude Code session, mirroring existing Slack workflows.

## Tech Stack

- Node.js (LTS) + TypeScript
- `@modelcontextprotocol/sdk` for the MCP server scaffolding (stdio transport)
- `zod` for input schema validation on each tool
- Plain `fetch` (built into modern Node) for HTTP calls to Pumble — no need
  for the official `pumble-node-sdk`, since that SDK targets full OAuth2
  Pumble *Apps* (bot install, event listeners, `tokenStore`, etc.), not the
  simple per-workspace API-key addon this project uses. The API-key addon is
  a plain REST API and doesn't need that machinery.

## Pumble API Reference (confirmed from live OpenAPI spec)

Base URL: `https://pumble-api-keys.addons.marketplace.cake.com`
Full interactive docs: `https://pumble-api-keys.addons.marketplace.cake.com/api-docs/`

Auth: header `ApiKey: <your-api-key>` on every request (OpenAPI
`securitySchemes.ApiKeyAuth`, `in: header`, `name: ApiKey`). Note the header
name is `ApiKey`, **not** `Api-Key` or `Authorization`.

Key generated from Pumble workspace → install the "API Key" addon → generate
key there (ephemeral message with the key value, copy it once).

Endpoints used by this project (all under the base URL above):

| Tool | Method & Path | Body / Query | Notes |
|---|---|---|---|
| Send message | `POST /sendMessage` | `{ channel? , channelId?, text, asBot? }` | Provide `channel` (name) OR `channelId`; `channelId` wins if both given. `asBot` defaults false. |
| List messages | `GET /listMessages` | query: `channelId?`, `channel?`, `cursor?`, `limit?`, `strategy?` | Either `channel` or `channelId` required. Cursor-based pagination. |
| Edit message | `POST /editMessage` | `{ messageId, channelId, text }` | Returns 200 on success, 403 with `{ error }` on bad params. |
| List channels | `GET /listChannels` | — | Returns array of `{ channel: {...} }` objects (id, name, channelType, isMember, etc.) — no auth-scoped filtering documented, returns everything the API key can see. |

Other endpoints exist (`fetchMessage`, `deleteMessage`, `sendReply`, `dmUser`,
`addReaction`, scheduled messages, `listUsers`, etc.) — out of scope for v1,
but the same base URL/auth applies if we extend later.

Rate limit: ~1000 requests/minute per user (per Pumble help docs).

## MCP Tools to Expose (v1)

Naming mirrors the Slack plugin's convention (`slack_send_message` etc.):

- `pumble_send_message(channel | channelId, text, asBot?)`
- `pumble_list_messages(channel | channelId, cursor?, limit?)`
- `pumble_edit_message(messageId, channelId, text)`
- `pumble_list_channels()`

Each tool validates that exactly one of `channel`/`channelId` is given where
both are accepted, and surfaces Pumble's error body verbatim on non-200
responses (don't swallow the `error` field).

## Commands

```
Install:  npm install
Build:    npm run build        # tsc -> dist/
Dev:      npm run dev          # ts-node / tsx watch of src/index.ts
Typecheck: npm run typecheck   # tsc --noEmit
Test:     npm test             # vitest
Run (MCP): node dist/index.js  # stdio MCP server, invoked by Claude Code config
```

## Project Structure

```
pumble-mcp/
  src/
    index.ts          → MCP server entrypoint, registers tools, stdio transport
    pumbleClient.ts    → thin fetch wrapper: base URL, ApiKey header, error handling
    tools/
      sendMessage.ts
      listMessages.ts
      editMessage.ts
      listChannels.ts
  tests/
    pumbleClient.test.ts   → unit tests against a mocked fetch
    tools/*.test.ts        → per-tool input validation + happy path
  .env.example        → PUMBLE_API_KEY=
  tasks/
    plan.md
    todo.md
  package.json
  tsconfig.json
  README.md            → setup instructions + Claude Code registration snippet
```

## Code Style

```ts
// pumbleClient.ts
export async function pumbleRequest<T>(
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; query?: Record<string, string>; body?: unknown },
): Promise<T> {
  const url = new URL(path, PUMBLE_BASE_URL);
  if (init.query) for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method: init.method,
    headers: { ApiKey: apiKey, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pumble API ${init.method} ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}
```

- No classes where a function will do.
- Zod schemas colocated with each tool file, exported and reused for the MCP
  tool's `inputSchema` and for parsing before the API call.
- No comments explaining *what* — only *why* (e.g. why `pumble-node-sdk` isn't used, above).

## Testing Strategy

- `vitest` for unit tests.
- Mock `global.fetch` — no live calls to Pumble in CI/tests.
- Cover: correct URL/method/headers built per endpoint, error surfacing on
  non-200, `channel` vs `channelId` XOR validation.
- No end-to-end test against the real Pumble workspace is required for v1,
  but a manual smoke test (send → list → edit against a real test channel)
  is part of the Definition of Done before calling this "working."

## Boundaries

- **Always do:** validate `channel`/`channelId` XOR before calling Pumble;
  surface Pumble's raw error text on failures; keep the API key out of git
  (`.env`, gitignored).
- **Ask first:** adding new Pumble endpoints beyond what's already wired up;
  changing the tool names once Claude Code config references them; adding
  any dependency beyond `@modelcontextprotocol/sdk`, `zod`, and dev/test
  tooling.
- **Never do:** log the raw API key; commit `.env`; call a destructive Pumble
  endpoint without an explicit confirmation gate. `removeUserFromChannel` is
  the one destructive endpoint in scope, and only because it requires the
  caller to pass `confirm: true`; `deleteMessage` and similar remain out of
  scope — don't add them without an explicit ask.

## Success Criteria

- `npm run build && npm test` pass.
- Registering the server in Claude Code's MCP config exposes all four tools.
- Manual smoke test: Claude sends a message to a real test channel, lists
  channel messages and sees it, edits it, and the edit is visible when
  listing again.
- README documents: how to generate the Pumble API key, how to set
  `PUMBLE_API_KEY`, and the exact Claude Code config snippet to register the
  server (mirroring how the Slack plugin is registered).

## Open Questions

Resolved:
1. Manual smoke test targets the **`general`** channel.
2. `asBot` stays `false` (Pumble's default) — messages send as the API-key
   user's own account, not as a bot/integration identity.
