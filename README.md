# pumble-mcp

A small MCP server that wraps Pumble's "API Key addon" REST API, exposing six
tools to Claude Code: send a message, list channel messages, edit a message,
list channels, send a direct message, and list workspace users. See `SPEC.md`
for the full design.

> **Security note:** the Pumble API key you configure grants broad,
> workspace-wide access. Read the [Security / Permissions](#security--permissions)
> section before installing.

## 1. Get a Pumble API key

1. In your Pumble workspace, install the **API Key** addon (Apps/Integrations).
2. Generate a key from the addon's settings. Pumble shows it once as an
   ephemeral message — copy it immediately.

## 2. Configure the key

```bash
cp .env.example .env
# edit .env and set PUMBLE_API_KEY=<your key>
```

`.env` is gitignored — never commit it. If you'd rather set it globally for
your shell (so any tool can use it without a `.env` file), add to
`~/.bashrc`:

```bash
export PUMBLE_API_KEY="<your key>"
```

## 3. Install, build

```bash
npm install
npm run build
```

## 4. Register with Claude Code

Register this as an MCP server using the absolute path to the built entry
point on your machine. Run this from the project root so `$(pwd)` resolves
correctly:

```bash
claude mcp add pumble --env PUMBLE_API_KEY="$PUMBLE_API_KEY" -- node "$(pwd)/dist/index.js"
```

This writes an entry for `pumble` into Claude Code's MCP server config so
future sessions automatically have all six tools available, the same way
Slack's tools show up as `mcp__plugin_slack_slack__*`.

Verify it's registered:

```bash
claude mcp list
```

## Development

```bash
npm run dev         # watch mode
npm run typecheck   # tsc --noEmit
npm test            # vitest
```

## Tools

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_send_message` | `POST /sendMessage` | `channel` or `channelId` (exactly one), `text`, `asBot` (default `false` — posts as your own user) |
| `pumble_list_messages` | `GET /listMessages` | `channel` or `channelId` (exactly one), optional `cursor`/`limit`; returns `{ hasMoreAfter, hasMoreBefore, messages }` |
| `pumble_edit_message` | `POST /editMessage` | `messageId`, `channelId`, `text` |
| `pumble_list_channels` | `GET /listChannels` | No input; returns every channel visible to the key, **including DM (`channelType DIRECT`) and group-DM channels** |
| `pumble_send_dm` | `POST /dmUser` | `userId` or `email` (exactly one), `text` |
| `pumble_list_users` | `GET /listUsers` | No input; returns every workspace member's `id`, `name`, `email` |

## Security / Permissions

This server hands a single static Pumble API key to an MCP server that Claude
Code can call. Understand the blast radius before installing:

- The API key inherits the full visibility and privileges of the Pumble user
  who generated it. It is a **password-equivalent secret**.
- With these six tools, anyone able to invoke this server (including any Claude
  session configured with it) can, **as you**:
  - read, send, and edit messages in **any channel the key can see**;
  - send direct messages to any user (`pumble_send_dm`);
  - enumerate **every workspace member's name and email** (`pumble_list_users`);
  - read **DM history** — `pumble_list_channels` returns DM channels
    (`channelType DIRECT`), whose `channelId` feeds `pumble_list_messages`.
- There is no per-tool scoping and no read-only mode: one key means full
  read/write across channels, DMs, and the user directory.

Recommendations:
- Never commit `.env` (it is gitignored). Do not paste the key into logs,
  issues, or chat.
- If the key is ever exposed, rotate it: generate a new key in the API Key
  addon, update `.env`, confirm it works, then revoke the old key.
- If your workspace allows it, generate the key from a dedicated,
  least-privilege service account rather than a full-admin user.
