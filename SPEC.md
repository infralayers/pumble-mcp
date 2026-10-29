# Spec: Pumble MCP Server (`@infralayers/pumble-mcp`)

## 1. Objective

Build and maintain a universal, production-grade **Model Context Protocol (MCP)** server wrapping Pumble's official "API Key add-on" REST API. The server exposes twenty-six (26) autonomous tools to any MCP-compliant client or AI agent (Cursor, Cline / Roo Code, Windsurf, Claude Desktop, Claude Code CLI, Google Antigravity, OpenHands, Zed).

Key objectives:
1. **100% Official API Coverage**: Complete exposure of all 26 Pumble REST endpoints.
2. **Zero-Token Speculative Lookup**: Headless agent architecture where all action tools natively resolve human-readable channel names, user names, and emails in-memory (~0.05ms) without requiring AI reconnaissance queries.
3. **Loop-Prevention Circuit Breaker**: Finite State Machine (FSM) guardrail preventing compulsive verification reads and containing resolution failures.
4. **Affirmative Execution Receipts**: Structured receipts confirming delivery and state updates to satisfy agent closure.
5. **Human-in-the-Loop Safety Gate**: Dynamic single-use confirmation challenge (`AUTH-XXXX`) protecting destructive endpoints.

---

## 2. Tech Stack

- **Runtime**: Node.js (>=18.0.0, LTS) + TypeScript (ESModules, `"type": "module"`)
- **Protocol Scaffolding**: `@modelcontextprotocol/sdk` (stdio transport)
- **Schema Validation**: `zod` (`v3.23.8+`) with parameter descriptions and guardrails
- **HTTP Client**: Native Node `fetch` with custom error wrapping and latency logging
- **Test Runner**: `vitest` (`v2.0.0+`) with synthetic test fixtures and timer mocks
- **Packaging**: npm public package `@infralayers/pumble-mcp` with CLI binary (`npx -y @infralayers/pumble-mcp`)

---

## 3. Pumble API Reference

- **Base URL**: `https://pumble-api-keys.addons.marketplace.cake.com`
- **Documentation**: `https://pumble-api-keys.addons.marketplace.cake.com/api-docs/`
- **Authentication**: HTTP Header `ApiKey: <your-api-key>` on every request.
- **Key Generation**: Workspace ➜ Apps & Integrations ➜ API Key Addon.
- **Rate Limit**: ~1,000 requests/minute per user.

---

## 4. Architecture & Core Systems

### 4.1 In-Memory RAM Cache & Entity Resolution (`src/tools/resolve.ts`)
- **Latency Target**: ~0.05ms steady-state lookups vs ~1,500ms network round-trips.
- **Boot Prefetching**: Users (`/listUsers`), channels (`/listChannels`), and bot info (`/myInfo`) are warmed concurrently on server startup via `prefetchIdentifiers()` without blocking the MCP handshake.
- **TTL**: 60-second in-memory TTL (`DEFAULT_CACHE_TTL_MS = 60_000`).
- **Write-Through Updates**: Channel creation, member additions/removals, and custom status updates update the local RAM cache immediately in 0ms.
- **Resolution Strategy**: Resolves exact 24-character hex IDs, channel names (case-insensitive, `#` stripping), user real names, usernames, and email addresses. Rejects ambiguous duplicates.
- **Direct Message Guards**: Protects DM channels (`channelType: "DIRECT" | "SELF"`) from invalid member additions or removals.

### 4.2 Finite State Machine (FSM) Circuit Breaker (`src/guardrails/environmentFSM.ts`)
A functional, module-scoped state machine governing tool execution safety:
- **States**:
  - `HEALTHY`: All action, info, and mutating tools are open. Investigation and bulk read tools require initial pre-execution airlock acknowledgment.
  - `LOCKED`: Fast-fail 3-second lockout engaged upon entity resolution failure. Blocks the failed tool, all investigation tools (`search_messages`, `list_messages`, etc.), and bulk read tools (`list_channels`, `list_users`).
  - `HALF_OPEN`: 60-second probation airlock following the 3s lock. Requires explicit pre-execution acknowledgment before permitting exploratory tool invocation.
- **Self-Healing**: Successful execution of any mutating tool (`sendMessage`, `replyMessage`, `addUsersToChannel`, etc.) immediately resets the circuit back to `HEALTHY`.
- **Destructive Challenge Gate**: Unguessable, single-use server-generated tokens (`AUTH-XXXX`, 60s TTL) intercept destructive calls (`remove_user_from_channel`, `delete_scheduled_message`, `delete_message`) until confirmed by the caller.

### 4.3 Context Window Optimization
- **Message List Compaction**: Client-side message limits capped at 10 by default (max 50).
- **Payload Flattening**: File attachments compacted to names/types; redundant emoji reaction objects deduplicated; empty text fields omitted.
- **In-Memory Author Resolution**: Message author user IDs resolved to human-readable names directly from local cache.

---

## 5. 26-Tool Taxonomy

The server implements 100% official Pumble REST API coverage across 5 functional categories:

### 5.1 Messages & Threads (8 Tools)
1. `send_message_via_channel_name_or_id` (`POST /sendMessage`)
2. `list_messages_via_channel_name_or_id` (`GET /listMessages`)
3. `get_message_via_id` (`GET /fetchMessage`)
4. `edit_message` (`POST /editMessage`)
5. `delete_message` (`DELETE /deleteMessage`) — *Destructive (AUTH-XXXX)*
6. `reply_message_via_channel_name_or_id` (`POST /sendReply`)
7. `list_thread_replies_via_channel_name_or_id` (`GET /fetchThreadReplies`)
8. `search_messages` (`POST /searchMessages`) — *Airlock Guarded*

### 5.2 Scheduled Messages (5 Tools)
9. `create_scheduled_message_via_name_or_id` (`POST /createScheduledMessage`)
10. `list_scheduled_messages` (`GET /fetchScheduledMessages`)
11. `get_scheduled_message_via_name_or_id` (`GET /getScheduledMessage`)
12. `edit_scheduled_message_via_name_or_id` (`POST /editScheduledMessage`)
13. `delete_scheduled_message_via_name_or_id` (`DELETE /deleteScheduledMessage`) — *Destructive (AUTH-XXXX)*

### 5.3 Reactions (2 Tools)
14. `add_reaction` (`POST /addReaction`)
15. `remove_reaction` (`POST /removeReaction`)

### 5.4 Channels & Membership (5 Tools)
16. `list_channels_only_when_user_calls` (`GET /listChannels`) — *Bulk Read Guarded*
17. `get_channel_detail_via_channel_name_or_id` (`GET /getChannel`)
18. `create_channel` (`POST /createChannel`)
19. `add_users_to_channel_via_name_or_id` (`POST /addUsersToChannel`) — *DM Protected*
20. `remove_user_from_channel_via_name_or_id` (`POST /removeUserFromChannel`) — *Destructive (AUTH-XXXX) & DM Protected*

### 5.5 Workspace, Users & Status (6 Tools)
21. `send_dm_via_name_email_or_id` (`POST /dmUser`)
22. `send_group_dm_via_names_emails_or_ids` (`POST /groupDm`)
23. `list_users_not_for_id_lookup` (`GET /listUsers`) — *Bulk Read Guarded*
24. `get_my_info` (`GET /myInfo`)
25. `list_user_groups` (`GET /listUserGroups`)
26. `update_my_custom_status` (`POST /updateCustomStatus`)

---

## 6. Project Structure

```
pumble-mcp/
  src/
    index.ts                  → CLI binary entrypoint (#!/usr/bin/env node), tool registration, stdio transport
    pumbleClient.ts           → Fetch wrapper: base URL, ApiKey auth, latency & error logging
    logger.ts                 → Diagnostic logging to stderr and local pumble.log
    guardrails/
      environmentFSM.ts       → Functional Finite State Machine, taxonomy, airlock, and challenge gate
    tools/
      resolve.ts              → In-memory cache, boot prefetch, write-through mutations, identifier resolver
      sendMessage.ts          → POST /sendMessage
      listMessages.ts         → GET /listMessages (payload compacted)
      getMessage.ts           → GET /fetchMessage
      editMessage.ts          → POST /editMessage
      deleteMessage.ts        → DELETE /deleteMessage
      replyMessage.ts         → POST /sendReply
      listThreadReplies.ts    → GET /fetchThreadReplies
      searchMessages.ts       → POST /searchMessages
      createScheduledMessage.ts → POST /createScheduledMessage
      listScheduledMessages.ts  → GET /fetchScheduledMessages
      getScheduledMessage.ts    → GET /getScheduledMessage
      editScheduledMessage.ts   → POST /editScheduledMessage
      deleteScheduledMessage.ts → DELETE /deleteScheduledMessage
      addReaction.ts          → POST /addReaction
      removeReaction.ts       → POST /removeReaction
      listChannels.ts         → GET /listChannels
      getChannel.ts           → GET /getChannel
      createChannel.ts        → POST /createChannel
      addUsersToChannel.ts    → POST /addUsersToChannel (DM guard)
      removeUserFromChannel.ts→ POST /removeUserFromChannel (DM guard)
      sendDm.ts               → POST /dmUser
      sendGroupDm.ts          → POST /groupDm
      listUsers.ts            → GET /listUsers
      getMyInfo.ts            → GET /myInfo
      listUserGroups.ts       → GET /listUserGroups
      updateCustomStatus.ts   → POST /updateCustomStatus
  tests/
    pumbleClient.test.ts      → Client fetch, URL parsing, and auth tests
    guardrails/
      environmentFSM.test.ts  → Circuit state transitions, probation, and security gate tests
    tools/*.test.ts           → 27 per-tool test suites (synthetic fixtures only)
  package.json                → @infralayers/pumble-mcp, CLI bin mapping, files whitelist
  tsconfig.json               → ES2022, NodeNext module resolution, strict type checking
  README.md                   → Documentation, quick start, SEO badges, and security guidance
  LICENSE                     → MIT License
```

---

## 7. Code Style & Engineering Guidelines

1. **Functional / Procedural Paradigm**:
   - Strictly avoid unnecessary classes. Use plain exported functions, module-scoped state, and TypeScript interfaces.
2. **Synthetic Test Fixtures Only**:
   - Never use real workspace user names or channel names in test fixtures. Always use synthetic identifiers (`UserAlpha`, `UserBeta`, `c_test_channel`, `c_dm_alpha`, `GhostUser`).
3. **Zod Parameter Contracts**:
   - Colocate Zod schemas with each tool. Maintain clear descriptive instructions (`DO NOT GUESS`, `MUST ASK`) on ambiguous parameters.
4. **Execution Transparency**:
   - Every file edit or command execution must be announced explicitly with purpose and expected outcome.

---

## 8. Deployment, Packaging & Distribution

- **Registry**: Official public npm registry (`npmjs.com`).
- **Package Name**: `@infralayers/pumble-mcp`
- **Package URL**: `https://www.npmjs.com/package/@infralayers/pumble-mcp`
- **Execution Contract**: Zero-install CLI execution supported globally via `npx -y @infralayers/pumble-mcp`.
- **Binary Mapping**: Registered `"bin": { "pumble-mcp": "./dist/index.js" }` with `#!/usr/bin/env node` shebang.
- **Artifact Whitelist**: Lean packaging whitelisting only production assets (`dist/`, `README.md`, `LICENSE`, `package.json`). Target compressed size: ~23.5 kB (unpacked: ~105 kB across 35 files).
- **Verification Gates**: Automated `"prepublishOnly": "npm run build && npm test"` hook ensuring all 29 test suites (168 tests) pass before any registry publish.
- **Node Engine Compatibility**: `"engines": { "node": ">=18.0.0" }`.
- **License**: MIT (Open Source).
