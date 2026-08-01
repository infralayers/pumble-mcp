# pumble-mcp

A small MCP server that wraps Pumble's "API Key addon" REST API, exposing
fifteen tools to any MCP client, covering messages and threads, reactions, search,
channel and membership management, direct messages, and the workspace user
directory. See `SPEC.md` for the full design.

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

## 4. Register with an MCP client

The server speaks MCP over stdio, so any MCP-capable client can run it. Point
the client at the built entry point using an absolute path, and pass
`PUMBLE_API_KEY` through the environment:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/pumble-mcp/dist/index.js"],
  "env": { "PUMBLE_API_KEY": "<your key>" }
}
```

Claude Code can write that entry for you. Run this from the project root so
`$(pwd)` resolves correctly:

```bash
claude mcp add pumble --env PUMBLE_API_KEY="$PUMBLE_API_KEY" -- node "$(pwd)/dist/index.js"
```

Once registered, all fifteen tools are available in future sessions. Verify
with:

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

### Messages & threads

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_send_message` | `POST /sendMessage` | `channel` or `channelId` (exactly one), `text`, `asBot` (default `false` — posts as your own user) |
| `pumble_list_messages` | `GET /listMessages` | `channel` or `channelId` (exactly one), optional `cursor`/`limit`; returns `{ hasMoreAfter, hasMoreBefore, messages }` |
| `pumble_edit_message` | `POST /editMessage` | `messageId`, `channelId`, `text` |
| `pumble_reply_message` | `POST /sendReply` | `messageId`, `channelIdentifier`, `text`, `asBot` (default `false`); starts or continues a thread |
| `pumble_list_thread_replies` | `GET /fetchThreadReplies` | `messageId`, `channelIdentifier`, optional `cursor`/`limit`; returns a bare array of replies, **newest first** |
| `pumble_search_messages` | `GET /searchMessages` | At least one of `text`, `fromUser`, `inChannel`; user and channel names resolve to IDs automatically |

`channelIdentifier` accepts either a channel name or a 24-character ID — names
are resolved for you, and an ambiguous name is rejected rather than guessed.

Thread paging is inclusive: `cursor` names the reply to resume from and that
reply comes back again, so `cursor` plus `limit: N` returns **N + 1** items.
The response carries no `hasMore` flag; a short page means the end.

### Reactions

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_add_reaction` | `POST /addReaction` | `messageId`, `channelId`, `reaction` (emoji code, e.g. `:thumbsup:`) |
| `pumble_remove_reaction` | `POST /removeReaction` | `messageId`, `channelId`, `reaction` |

### Channels

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_list_channels` | `GET /listChannels` | No input; returns every channel visible to the key, **including DM (`channelType DIRECT`) and group-DM channels** |
| `pumble_get_channel` | `GET /getChannel` | `channel` or `channelId` (exactly one) |
| `pumble_create_channel` | `POST /createChannel` | `name`, `type` (`PUBLIC` or `PRIVATE`) |
| `pumble_add_users_to_channel` | `POST /addUsersToChannel` | `channel` or `channelId` (exactly one), `users` — an array of names, emails, or IDs |
| `pumble_remove_user_from_channel` | `POST /removeUserFromChannel` | `channel` or `channelId` (exactly one), `user`, and `confirm: true` — **destructive, the confirmation is mandatory** |

### Workspace

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_send_dm` | `POST /dmUser` | `userId` or `email` (exactly one), `text` |
| `pumble_list_users` | `GET /listUsers` | No input; returns every workspace member's `id`, `name`, `email` |

## Security / Permissions

This server hands a single static Pumble API key to an MCP server that any
connected client can call. Understand the blast radius before installing:

- The API key inherits the full visibility and privileges of the Pumble user
  who generated it. It is a **password-equivalent secret**.
- With these fifteen tools, anyone able to invoke this server (including any
  model or client session configured with it) can, **as you**:
  - read, send, edit, and reply to messages in **any channel the key can see**,
    including thread replies;
  - **search across the workspace** by text, author, or channel
    (`pumble_search_messages`) — this makes bulk retrieval far easier than
    reading channels one at a time;
  - send direct messages to any user (`pumble_send_dm`);
  - enumerate **every workspace member's name and email** (`pumble_list_users`);
  - read **DM history** — `pumble_list_channels` returns DM channels
    (`channelType DIRECT`), whose `channelId` feeds `pumble_list_messages`;
  - **create channels** and **change who is in them** — adding members exposes
    channel history to those users, and removing them revokes access
    (`pumble_remove_user_from_channel` demands `confirm: true`, which stops an
    accidental call but not a deliberate one);
  - react to messages as you (`pumble_add_reaction`).
- There is no per-tool scoping and no read-only mode: one key means full
  read/write across channels, DMs, and the user directory.

Recommendations:
- Never commit `.env` (it is gitignored). Do not paste the key into logs,
  issues, or chat.
- If the key is ever exposed, rotate it: generate a new key in the API Key
  addon, update `.env`, confirm it works, then revoke the old key.
- If your workspace allows it, generate the key from a dedicated,
  least-privilege service account rather than a full-admin user.
