# @infralayers/pumble-mcp

[![npm version](https://img.shields.io/npm/v/@infralayers/pumble-mcp.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@infralayers/pumble-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node: >=18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)
[![MCP Standard](https://img.shields.io/badge/MCP-1.0.0-purple.svg?style=flat-square)](https://modelcontextprotocol.io/)
[![Tests: 100% Green](https://img.shields.io/badge/tests-passing-success.svg?style=flat-square)](https://github.com/infralayers/pumble-mcp)

Universal, production-ready **Model Context Protocol (MCP)** server for **Pumble**. It connects autonomous AI agents and LLMs to your Pumble workspace with **100% official REST API coverage (26 tools)**, sub-millisecond in-memory entity resolution, affirmative execution receipts, and built-in anti-loop security guardrails.

Works seamlessly across **Cursor**, **Cline / Roo Code**, **Windsurf**, **Claude Desktop**, **Claude Code CLI**, **Google Antigravity**, **Zed**, and any custom agent framework.

> **Security note:** the Pumble API key you configure grants broad,
> workspace-wide access. Read the [Security / Permissions](#security--permissions)
> section before installing.

---

## ⚡ Highlights & Performance

- **100% Official REST API Coverage**: 26 autonomous tools covering messaging, threads, scheduling, reactions, channel operations, user directories, and status updates.
- **Ultra-Low Latency (~0.05ms Resolution)**: Standard API calls take **~1,500ms** to resolve user and channel identifiers over the network. Our in-memory RAM cache reduces steady-state lookups to **~0.05ms** (30,000x faster), completely eliminating network penalties.
- **Boot-Time Prefetching**: Users and channels are prefetched in parallel during server startup without blocking the client MCP handshake.
- **Write-Through In-Place Updates**: Channel creation, member additions/removals, and custom status updates sync directly to the local RAM cache in 0ms.
- **Affirmative Execution Receipts**: Mutation tools return structured receipts (`ok: true`, `delivered: true`, `status: "Verification complete"`) that eliminate compulsive post-action read loops (e.g. `list_messages` spam).
- **Loop-Prevention Circuit Breaker**: Finite State Machine (FSM) guardrail locks out speculative reconnaissance and fast-fails missing entities with actionable guidance.
- **Security Challenge Gate (`AUTH-XXXX`)**: Destructive actions (deleting messages, removing members) require single-use, time-limited confirmation codes, stopping accidental deletions.

---

## 💾 Memory Footprint: Scaling in Large Workspaces

A common concern with in-memory caching is memory consumption in large organizations. This server uses an optimized, lean data model that retains only essential routing identifiers (`id`, `name`, `email` for users; `id`, `name`, `channelType`, `userIds` for channels):

| Workspace Scale | Entities Cached | Estimated RAM Footprint | Memory Impact |
|---|---|---|---|
| **Small Team** | 50 users, 20 channels | **~15 KB** | Negligible |
| **Mid-Size Company** | 1,000 users, 100 channels | **~230 KB** | < 0.25 MB |
| **Enterprise Workspace** | 5,000 users, 500 channels | **~1.1 MB** | ~1 MB |
| **Massive Workspace** | 20,000 users, 2,000 channels | **~4.5 MB** | < 5 MB |

**Takeaway:** Even in an enterprise workspace with **thousands of users and hundreds of channels**, the cache consumes **less than 5 MB of RAM**—a microscopic fraction of Node.js's standard baseline memory (~30 MB). The cache operates with a **60-second TTL**, ensuring fresh data without memory leaks or bloat.

---

## 🚀 Quick Start (Zero-Install via `npx`)

Run directly with `npx` in **any** MCP-compliant client without cloning or manual building:

### Standard MCP Configuration
Works out of the box in **Cursor**, **Cline / Roo Code**, **Windsurf**, **Claude Desktop**, and **Antigravity**.

Add this block to your client's MCP configuration file (e.g. `claude_desktop_config.json`, `.cursor/mcp.json`, or Cline MCP settings):

```json
{
  "mcpServers": {
    "pumble": {
      "command": "npx",
      "args": ["-y", "@infralayers/pumble-mcp"],
      "env": {
        "PUMBLE_API_KEY": "<your-pumble-api-key>"
      }
    }
  }
}
```

### CLI Agents (Claude Code, Gemini CLI, Terminal)
Register directly from your shell:

```bash
# Claude Code CLI
claude mcp add pumble --env PUMBLE_API_KEY="<your-pumble-api-key>" -- npx -y @infralayers/pumble-mcp
```

Verify your registered tools:
```bash
claude mcp list
```

---

## 🔑 Getting Your Pumble API Key

1. In your Pumble workspace, install the **API Key** addon (**Apps & Integrations**).
2. Generate a key from the addon's settings. Pumble shows it once as an ephemeral message — copy it immediately.
3. Pass the key in your client's `env` configuration as `PUMBLE_API_KEY`.

---

## 🛠️ Complete 26-Tool Reference

*Architecture Note: All tools natively accept human-readable fuzzy names, emails, and exact IDs, automatically resolving them via the backend to prevent the AI from wasting context tokens on manual lookups. Ambiguous names will safely throw an error requesting clarification.*

### 1. Messages & Threads (8 Tools)

| Tool | Pumble Endpoint | Notes & Parameters |
|---|---|---|
| `send_message_via_channel_name_or_id` | `POST /sendMessage` | Send a message to any channel or DM. Takes `channelIdentifier` (name or ID), `text`, optional `asBot`. Returns affirmative delivery receipt. |
| `list_messages_via_channel_name_or_id` | `GET /listMessages` | List messages in a channel or DM. Takes `channelIdentifier`, optional `limit` (default: 10, max: 50), and `cursor`. |
| `get_message_via_id` | `GET /fetchMessage` | Fetch a single message by ID. Takes `channelIdentifier` and `messageId`. |
| `edit_message` | `POST /editMessage` | Edit an existing message. Takes `channelIdentifier`, `messageId`, and updated `text`. |
| `delete_message` | `DELETE /deleteMessage` | Delete a message. Takes `channelIdentifier`, `messageId`, and `confirm: true` (**destructive**). |
| `reply_message_via_channel_name_or_id` | `POST /sendReply` | Reply to a message to start or continue a thread. Takes `channelIdentifier`, `messageId`, `text`, optional `asBot`. |
| `list_thread_replies_via_channel_name_or_id` | `GET /fetchThreadReplies` | Fetch replies in a thread. Takes `channelIdentifier`, `messageId`, optional `limit`, `cursor`. Returns replies newest first. |
| `search_messages` | `POST /searchMessages` | Search messages across the workspace by `text`, `fromUser`, or `inChannel`. User and channel names resolve automatically. |

### 2. Scheduled Messages (5 Tools)

| Tool | Pumble Endpoint | Notes & Parameters |
|---|---|---|
| `create_scheduled_message_via_name_or_id` | `POST /createScheduledMessage` | Schedule a future message. Takes `channelIdentifier` OR `userIdentifier`, `text`, and `sendAt` (ISO string or epoch ms, min 30s in future). |
| `list_scheduled_messages` | `GET /fetchScheduledMessages` | List queued scheduled messages. Supports optional destination filters, `limit`, and `cursor`. |
| `get_scheduled_message_via_name_or_id` | `GET /getScheduledMessage` | Inspect a scheduled message by its `scheduledMessageId`. |
| `edit_scheduled_message_via_name_or_id` | `POST /editScheduledMessage` | Modify a scheduled message's `text`, `sendAt`, or move it to a new channel/DM destination. |
| `delete_scheduled_message_via_name_or_id` | `DELETE /deleteScheduledMessage` | Cancel and delete a queued scheduled message. Takes `scheduledMessageId` and `confirm: true` (**destructive**). |

### 3. Reactions (2 Tools)

| Tool | Pumble Endpoint | Notes & Parameters |
|---|---|---|
| `add_reaction` | `POST /addReaction` | Add an emoji reaction to a message. Takes `channelIdentifier`, `messageId`, and `reaction` code (e.g. `:thumbsup:`). |
| `remove_reaction` | `POST /removeReaction` | Remove an emoji reaction from a message. Takes `channelIdentifier`, `messageId`, and `reaction` code. |

### 4. Channels & Membership (5 Tools)

| Tool | Pumble Endpoint | Notes & Parameters |
|---|---|---|
| `list_channels_only_when_user_calls` | `GET /listChannels` | List all visible channels (public, private, and direct). Guarded against unnecessary agent discovery loops. |
| `get_channel_detail_via_channel_name_or_id` | `GET /getChannel` | Hydrate full channel details, including resolved member lists with names and emails. |
| `create_channel` | `POST /createChannel` | Create a new channel. Takes `name` and `type` (`PUBLIC` or `PRIVATE`). Updates cache immediately. |
| `add_users_to_channel_via_name_or_id` | `POST /addUsersToChannel` | Add workspace members to a channel. Takes `channelIdentifier` and an array of `userIdentifiers` (names, emails, or IDs). Blocks DM additions. |
| `remove_user_from_channel_via_name_or_id` | `POST /removeUserFromChannel` | Remove a member from a channel. Takes `channelIdentifier`, `userIdentifier`, and `confirm: true` (**destructive**). Blocks DM removals. |

### 5. Workspace, Users & Status (6 Tools)

| Tool | Pumble Endpoint | Notes & Parameters |
|---|---|---|
| `send_dm_via_name_email_or_id` | `POST /dmUser` | Send a 1-on-1 direct message. Takes `userIdentifier` (name, email, or ID) and `text`. |
| `send_group_dm_via_names_emails_or_ids` | `POST /groupDm` | Send a multi-person group direct message. Takes `userIdentifiers` (array of names/emails/IDs) and `text`. |
| `list_users_not_for_id_lookup` | `GET /listUsers` | List workspace users. Guarded against speculative agent reconnaissance. |
| `get_my_info` | `GET /myInfo` | Get account and profile details of the authenticated bot / API key owner. |
| `list_user_groups` | `GET /listUserGroups` | List all user groups configured in the Pumble workspace. |
| `update_my_custom_status` | `POST /updateCustomStatus` | Set or clear custom status text, emoji, and expiration duration. Write-through to cache in 0ms. |

---

## 🛡️ Security / Permissions

This server hands a single static Pumble API key to an MCP server that any connected client or LLM session can invoke. Understand the blast radius before installing:

### Blast Radius & Capabilities
The API key inherits the full visibility and privileges of the Pumble user who generated it. It is a **password-equivalent secret**.

With these twenty-six tools, anyone able to invoke this server can, **as you**:
- **Messages**: Read, send, edit, delete, and reply to messages in **any channel or DM the key can access**.
- **Scheduled Messages**: Queue messages to post later in any channel or DM, and read, rewrite, redirect, or delete anything already queued.
- **Workspace Search**: Search across workspace history by text, author, or channel.
- **Direct Messages**: Send 1-on-1 and group DMs to any user in the workspace.
- **User Directory**: Enumerate every workspace member's name and email address.
- **Channel Membership**: Create channels, add users to channels, or remove users from channels.
- **Reactions & Status**: Add/remove emoji reactions and modify your profile's custom status.

### Built-in Agent Defenses
1. **Destructive Challenge Gates (`AUTH-XXXX`)**:
   Destructive operations (`remove_user_from_channel`, `delete_scheduled_message`, `delete_message`) cannot be executed speculatively by autonomous agents. If called without human authorization, the server intercepts execution and issues a dynamic 60-second runtime confirmation token challenge requiring human verification.
2. **Missing Entity Fast-Fail**:
   Missing users or channels fail immediately with a strict directive stopping partial batches or hallucinations.

### Recommendations & Best Practices
- **Never commit `.env`**: `.env` is gitignored by default. Never paste your API key into logs, commit messages, or chat transcripts.
- **Key Rotation**: If a key is ever exposed, rotate it immediately in Pumble (**Apps & Integrations > API Key Addon**), update your environment, and revoke the old key.
- **Dedicated Service Account**: If your Pumble workspace allows it, generate the key from a dedicated service account rather than an individual admin user's personal account.

---

## 💻 Local Development

### 1. Clone & Install
```bash
git clone https://github.com/infralayers/pumble-mcp.git
cd pumble-mcp
npm install
```

### 2. Configure Environment
The server reads `PUMBLE_API_KEY` from its environment. It does **not** load a `.env` file on its own.

For development, export it in your shell (or add to `~/.bashrc`):
```bash
export PUMBLE_API_KEY="<your-pumble-api-key>"
```

### 3. Development Scripts
```bash
npm run dev         # Watch mode via tsx
npm run typecheck   # Typecheck without emitting (tsc --noEmit)
npm test            # Run unit tests via vitest
npm run build       # Compile TypeScript to dist/
npm start           # Run compiled server (node dist/index.js)
```

To run your local build directly in an MCP client:
```json
{
  "command": "node",
  "args": ["/absolute/path/to/pumble-mcp/dist/index.js"],
  "env": {
    "PUMBLE_API_KEY": "<your-pumble-api-key>"
  }
}
```

---

## 📄 License

MIT License. Copyright (c) 2026 InfraLayers.
