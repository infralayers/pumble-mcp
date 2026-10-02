# pumble-mcp

A highly optimized, AI-native MCP server that wraps Pumble's "API Key addon" REST API. It exposes twenty-one autonomous tools to any MCP client, covering messages and threads, scheduled messages, reactions, search, channel and membership management, direct messages, and the workspace user directory. 

Designed with token-efficient semantic routing and stealth guardrails, it allows LLMs to seamlessly manage Pumble workspaces without manual ID lookups. See `SPEC.md` for the full design.

> **Security note:** the Pumble API key you configure grants broad,
> workspace-wide access. Read the [Security / Permissions](#security--permissions)
> section before installing.

## 1. Get a Pumble API key

1. In your Pumble workspace, install the **API Key** addon (Apps/Integrations).
2. Generate a key from the addon's settings. Pumble shows it once as an
   ephemeral message — copy it immediately.

## 2. Configure the key

The server reads `PUMBLE_API_KEY` from its own environment. It does **not**
load a `.env` file on its own, so set the variable one of these two ways.

For running the server directly (`npm run dev`, `npm start`), export it in your
shell — add this to `~/.bashrc` to make it stick:

```bash
export PUMBLE_API_KEY="<your key>"
```

For normal use through an MCP client, pass it in the client's `env` block
instead — see step 4. That is the usual path, and it needs nothing in your
shell.

`.env.example` lists the variables the server understands. If you keep a local
`.env` for your own tooling, it is gitignored — never commit it.

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

Once registered, all nineteen tools are available in future sessions. Verify
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

*Architecture Note: This server operates as a Headless Agent. All tools natively accept human-readable fuzzy names, emails, and exact IDs, automatically resolving them via the backend to prevent the AI from wasting context tokens on manual lookups. Ambiguous names will safely throw an error requesting clarification.*

### Messages & threads

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_send_message_via_channel_name_or_id` | `POST /sendMessage` | `channelIdentifier` (name or ID), `text`, `asBot` (default `false` — posts as your own user) |
| `pumble_list_messages_via_channel_name_or_id` | `GET /listMessages` | `channelIdentifier`, optional `cursor`/`limit`; returns `{ hasMoreAfter, hasMoreBefore, messages }` |
| `pumble_edit_message` | `POST /editMessage` | `messageId`, `channelId`, `text` |
|`pumble_reply_message_via_channel_name_or_id` | `POST /sendReply` | `messageId`, `channelIdentifier`, `text`, `asBot` (default `false`); starts or continues a thread |
| `pumble_list_thread_replies_via_channel_name_or_id` | `GET /fetchThreadReplies` | `messageId`, `channelIdentifier`, optional `cursor`/`limit`; returns a bare array of replies, **newest first** |
| `pumble_search_messages` | `GET /searchMessages` | At least one of `text`, `fromUser`, `inChannel`; user and channel names resolve to IDs automatically |

`channelIdentifier` accepts either a channel name or a 24-character ID — names
are resolved for you, and an ambiguous name is rejected rather than guessed.

Thread paging is inclusive: `cursor` names the reply to resume from and that
reply comes back again, so `cursor` plus `limit: N` returns **N + 1** items.
The response carries no `hasMore` flag; a short page means the end.

### Scheduled messages

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_create_scheduled_message` | `POST /createScheduledMessage` | `channelIdentifier` or `userIdentifier` (exactly one), `text`, `sendAt` (ISO string or epoch ms) |
| `pumble_list_scheduled_messages` | `GET /fetchScheduledMessages` | Optional `channelIdentifier` or `userIdentifier` (at most one), `cursor`, `limit`; returns `{ scheduledMessages, hasMore }` |
| `pumble_get_scheduled_message` | `GET /getScheduledMessage` | `scheduledMessageId` |
| `pumble_edit_scheduled_message` | `POST /editScheduledMessage` | `scheduledMessageId` plus any of `text`, `sendAt`, or a new destination — a scheduled message can be moved to another channel |
| `pumble_delete_scheduled_message` | `DELETE /deleteScheduledMessage` | `scheduledMessageId` and `confirm: true` — **destructive, the confirmation is mandatory** |

Naming a destination by anything other than an exact ID requires an extra lookup: the backend natively resolves channel names, user names, and emails to IDs for you. Targeting a person resolves to the **existing** DM channel
with them — Pumble creates one only after a first message, so DM someone before
scheduling to them.

Editing is read-modify-write because Pumble rejects an edit missing any of
`channelIdentifier`, `text`, or `sendAt`; fields you leave out are read back and resent
unchanged. There is no separate "get" tool — listing already returns whole
messages.

### Reactions

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_add_reaction` | `POST /addReaction` | `messageId`, `channelIdentifier`, `reaction` (emoji code, e.g. `:thumbsup:`) |
| `pumble_remove_reaction` | `POST /removeReaction` | `messageId`, `channelIdentifier`, `reaction` |

### Channels

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_list_channels` | `GET /listChannels` | No input; returns every channel visible to the key, **including DM (`channelType DIRECT`) and group-DM channels** |
| `pumble_get_channel_via_name_or_id` | `GET /getChannel` | `channelIdentifier` (name or ID). **Hydrates and returns the channel details with full `memberDetails` array (names and emails).** |
| `pumble_create_channel` | `POST /createChannel` | `name`, `type` (`PUBLIC` or `PRIVATE`) |
| `pumble_add_users_to_channel_via_name_or_id` | `POST /addUsersToChannel` | `channelIdentifier`, `userIdentifiers` — an array of names, emails, or IDs |
| `pumble_remove_user_from_channel_via_name_or_id` | `POST /removeUserFromChannel` | `channelIdentifier`, `userIdentifier`, and `confirm: true` — **destructive, the confirmation is mandatory**. Auto-intercepts 403s. |

### Workspace

| Tool | Pumble endpoint | Notes |
|---|---|---|
| `pumble_send_dm_via_name_email_or_id` | `POST /dmUser` | `userIdentifier` (name, email, or ID), `text` |
| `pumble_send_group_dm_via_name_email_or_id` | `POST /groupDm` | `userIdentifiers` (array of names, emails, or IDs), `text` |
| `pumble_list_users` | `GET /listUsers` | No input; returns every workspace member's `id`, `name`, `email` |

## Security / Permissions

This server hands a single static Pumble API key to an MCP server that any
connected client can call. Understand the blast radius before installing:

- The API key inherits the full visibility and privileges of the Pumble user
  who generated it. It is a **password-equivalent secret**.
- With these twenty-one tools, anyone able to invoke this server (including any
  model or client session configured with it) can, **as you**:
  - read, send, edit, and reply to messages in **any channel the key can see**,
    including thread replies;
  - **queue messages to post later** in any channel or DM, and read, rewrite,
    redirect, or cancel anything already queued — a scheduled message can fire
    long after the session that created it has ended;
  - **search across the workspace** by text, author, or channel
    (`pumble_search_messages`) — this makes bulk retrieval far easier than
    reading channels one at a time;
  - send direct messages to any user (`pumble_send_dm_via_name_email_or_id`);
  - enumerate **every workspace member's name and email** (`pumble_list_users`);
  - read **DM history** — `pumble_list_channels` returns DM channels
    (`channelType DIRECT`), whose `channelId` feeds `pumble_list_messages_via_channel_name_or_id`;
  - **create channels** and **change who is in them** — adding members exposes
    channel history to those users, and removing them revokes access
    (`pumble_remove_user_from_channel_via_name_or_id` demands `confirm: true`, which stops an
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
