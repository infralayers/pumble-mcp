#!/usr/bin/env node
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getScheduledMessage, getScheduledMessageSchema, getScheduledMessageShape } from "./tools/getScheduledMessage.js";
import { prefetchIdentifiers } from "./tools/resolve.js";

import { sendMessage, sendMessageSchema, sendMessageShape } from "./tools/sendMessage.js";
import { listMessages, listMessagesSchema, listMessagesShape } from "./tools/listMessages.js";
import { editMessage, editMessageSchema, editMessageShape } from "./tools/editMessage.js";
import { listChannels, listChannelsSchema, listChannelsShape } from "./tools/listChannels.js";
import { sendDm, sendDmSchema, sendDmShape } from "./tools/sendDm.js";
import { sendGroupDm, sendGroupDmSchema, sendGroupDmShape } from "./tools/sendGroupDm.js";
import { listUsers, listUsersSchema, listUsersShape } from "./tools/listUsers.js";
import { getChannel, getChannelSchema, getChannelShape } from "./tools/getChannel.js";
import { createChannel, createChannelSchema, createChannelShape } from "./tools/createChannel.js";
import { addUsersToChannel, addUsersToChannelSchema, addUsersToChannelShape } from "./tools/addUsersToChannel.js";
import { removeUserFromChannel, removeUserFromChannelSchema, removeUserFromChannelShape } from "./tools/removeUserFromChannel.js";
import { searchMessages, searchMessagesSchema, searchMessagesShape } from "./tools/searchMessages.js";
import { addReaction, addReactionSchema, addReactionShape } from "./tools/addReaction.js";
import { removeReaction, removeReactionSchema, removeReactionShape } from "./tools/removeReaction.js";
import { replyMessage, replyMessageSchema, replyMessageShape } from "./tools/replyMessage.js";
import { listThreadReplies, listThreadRepliesSchema, listThreadRepliesShape } from "./tools/listThreadReplies.js";
import { listScheduledMessages, listScheduledMessagesSchema, listScheduledMessagesShape } from "./tools/listScheduledMessages.js";
import { createScheduledMessage, createScheduledMessageSchema, createScheduledMessageShape } from "./tools/createScheduledMessage.js";
import { editScheduledMessage, editScheduledMessageSchema, editScheduledMessageShape } from "./tools/editScheduledMessage.js";
import { deleteScheduledMessage, deleteScheduledMessageSchema, deleteScheduledMessageShape } from "./tools/deleteScheduledMessage.js";
import { getMyInfo, getMyInfoSchema, getMyInfoShape } from "./tools/getMyInfo.js";
import { listUserGroups, listUserGroupsSchema, listUserGroupsShape } from "./tools/listUserGroups.js";
import { updateCustomStatus, updateCustomStatusSchema, updateCustomStatusShape } from "./tools/updateCustomStatus.js";
import { getMessage, getMessageSchema, getMessageShape } from "./tools/getMessage.js";
import { deleteMessage, deleteMessageSchema, deleteMessageShape } from "./tools/deleteMessage.js";

if (!process.env.PUMBLE_API_KEY) {
  console.error("PUMBLE_API_KEY environment variable is not set");
  process.exit(1);
}

const server = new McpServer({ name: "pumble-mcp", version: "0.1.0" });

import { fileURLToPath } from "url";

// Calculate the absolute path to the project root
// Since this runs from dist/index.js, __dirname is dist/. So '..' goes to the project root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Phase 3: Observability & Error Handling
import { logStderr } from "./logger.js";
import {
  checkToolAccess,
  reportResolutionError,
  reportSuccess,
} from "./guardrails/environmentFSM.js";
import { isResolutionError } from "./tools/resolve.js";

function cleanErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map(
      (issue) => `Field '${issue.path.join(".")}': ${issue.message}`
    );
    return `Validation Error(s):\n${issues.join("\n")}`;
  }

  const raw = error instanceof Error ? error.message : String(error);
  // Remove any stack trace lines if present
  const lines = raw.split("\n").filter((line) => !/^\s*at\s+/.test(line));
  return lines.join("\n").trim();
}

/**
 * Recursively strips nulls and empty metadata arrays to minimize LLM token consumption,
 * while preserving primary collection arrays (e.g. messages: []).
 */
export function pruneEmptyValues(val: unknown, keyName?: string): unknown {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    if (val.length === 0) {
      if (keyName === "messages" || keyName === "channels" || keyName === "users" || keyName === "scheduledMessages") {
        return [];
      }
      return undefined;
    }
    return val.map((item) => pruneEmptyValues(item)).filter((v) => v !== undefined);
  }
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      const pruned = pruneEmptyValues(v, k);
      if (pruned !== undefined) {
        out[k] = pruned;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return val;
}

function wrapToolHandler<S extends z.ZodTypeAny>(
  schema: S,
  handler: (input: z.infer<S>) => Promise<any>,
  toolName: string = "tool"
) {
  return async (args: unknown) => {
    const token = (args as any)?.confirmationToken;
    const access = checkToolAccess(toolName, token);

    if (!access.allowed) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: access.errorMessage || "Tool execution restricted by circuit breaker.",
          },
        ],
      };
    }

    try {
      const input = schema.parse(args);
      const result = await handler(input);
      // Mutating tools self-heal the circuit breaker to HEALTHY
      reportSuccess(toolName);
      const prunedResult = pruneEmptyValues(result) ?? { ok: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(prunedResult) }] };
    } catch (error: any) {
      logStderr("Tool execution error:", error?.stack || error?.message || error);

      // Zod validation errors: Agent input mistake. Allow immediate self-correction!
      if (error instanceof z.ZodError) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: cleanErrorMessage(error) }],
        };
      }

      const errMsg = cleanErrorMessage(error);
      if (isResolutionError(error)) {
        reportResolutionError(toolName, errMsg);
      }

      return {
        isError: true,
        content: [{ type: "text" as const, text: errMsg }],
      };
    }
  };
}

// === Messages & Threads ===
server.registerTool(
  "send_message_via_channel_name_or_id",
  {
    description: "Send a message to a public or private channel. Resolves channel names natively.",
    inputSchema: sendMessageShape,
  },
  wrapToolHandler(sendMessageSchema, sendMessage, "send_message_via_channel_name_or_id")
);

server.registerTool(
  "list_messages_via_name_or_id",
  {
    description: "List messages from a channel or direct message (DM) conversation. Resolves names natively.",
    inputSchema: listMessagesShape,
  },
  wrapToolHandler(listMessagesSchema, listMessages, "list_messages_via_name_or_id")
);

server.registerTool(
  "edit_message",
  {
    description: "Edit a previously sent message by ID.",
    inputSchema: editMessageShape,
  },
  wrapToolHandler(editMessageSchema, editMessage, "edit_message")
);

server.registerTool(
  "delete_message",
  {
    description: "Delete a message by ID in a channel. Destructive; requires confirmation code.",
    inputSchema: deleteMessageShape,
  },
  wrapToolHandler(deleteMessageSchema, deleteMessage, "delete_message")
);

server.registerTool(
  "get_message_via_id",
  {
    description: "Get full details of a specific message by ID and channel name or ID.",
    inputSchema: getMessageShape,
  },
  wrapToolHandler(getMessageSchema, getMessage, "get_message_via_id")
);

server.registerTool(
  "send_dm_via_name_email_or_id",
  {
    description: "Send a 1-on-1 direct message. Resolves user names/emails natively.",
    inputSchema: sendDmShape,
  },
  wrapToolHandler(sendDmSchema, sendDm, "send_dm_via_name_email_or_id")
);

server.registerTool(
  "send_group_dm_via_names_emails_or_ids",
  {
    description: "Send a group direct message to multiple users. Resolves names/emails natively.",
    inputSchema: sendGroupDmShape,
  },
  wrapToolHandler(sendGroupDmSchema, sendGroupDm, "send_group_dm_via_names_emails_or_ids")
);

server.registerTool(
  "get_my_info",
  {
    description: "Get profile information of the authenticated user/bot.",
    inputSchema: getMyInfoShape,
  },
  wrapToolHandler(getMyInfoSchema, getMyInfo, "get_my_info")
);

server.registerTool(
  "list_user_groups",
  {
    description: "List workspace user groups.",
    inputSchema: listUserGroupsShape,
  },
  wrapToolHandler(listUserGroupsSchema, listUserGroups, "list_user_groups")
);

server.registerTool(
  "update_my_custom_status",
  {
    description: "Update the custom status of the authenticated user.",
    inputSchema: updateCustomStatusShape,
  },
  wrapToolHandler(updateCustomStatusSchema, updateCustomStatus, "update_my_custom_status")
);

server.registerTool(
  "search_messages",
  {
    description: "Search message history by text query (~15s indexing delay). Do not use for user/channel ID lookups.",
    inputSchema: searchMessagesShape,
  },
  wrapToolHandler(searchMessagesSchema, searchMessages, "search_messages")
);

server.registerTool(
  "reply_message_via_channel_name_or_id",
  {
    description: "Reply to a message in a channel or DM thread using parent messageId. Resolves names natively.",
    inputSchema: replyMessageShape,
  },
  wrapToolHandler(replyMessageSchema, replyMessage, "reply_message_via_channel_name_or_id")
);

server.registerTool(
  "list_thread_replies_via_channel_name_or_id",
  {
    description: "List all replies in a message thread. Resolves names natively.",
    inputSchema: listThreadRepliesShape,
  },
  wrapToolHandler(listThreadRepliesSchema, listThreadReplies, "list_thread_replies_via_channel_name_or_id")
);

// === Reactions ===
server.registerTool(
  "add_reaction",
  {
    description: "Add an emoji reaction to a message by ID.",
    inputSchema: addReactionShape,
  },
  wrapToolHandler(addReactionSchema, addReaction, "add_reaction")
);

server.registerTool(
  "remove_reaction",
  {
    description: "Remove an emoji reaction from a message by ID.",
    inputSchema: removeReactionShape,
  },
  wrapToolHandler(removeReactionSchema, removeReaction, "remove_reaction")
);

// === Channels ===
server.registerTool(
  "list_channels_only_when_user_calls",
  {
    description: "List all visible channels. Use ONLY when the caller explicitly asks to view the channel directory.",
    inputSchema: listChannelsShape,
  },
  wrapToolHandler(listChannelsSchema, listChannels, "list_channels_only_when_user_calls")
);

server.registerTool(
  "get_channel_detail_via_channel_name_or_id",
  {
    description: "Get details of a specific channel. Use ONLY when the caller explicitly requests channel metadata.",
    inputSchema: getChannelShape,
  },
  wrapToolHandler(getChannelSchema, getChannel, "get_channel_detail_via_channel_name_or_id")
);

server.registerTool(
  "create_channel",
  {
    description: "Create a new public or private channel.",
    inputSchema: createChannelShape,
  },
  wrapToolHandler(createChannelSchema, createChannel, "create_channel")
);

server.registerTool(
  "add_users_to_channel_via_name_or_id",
  {
    description: "Add users to a channel by names or emails. Resolves entities natively.",
    inputSchema: addUsersToChannelShape,
  },
  wrapToolHandler(addUsersToChannelSchema, addUsersToChannel, "add_users_to_channel_via_name_or_id")
);

server.registerTool(
  "remove_user_from_channel_via_name_or_id",
  {
    description: "Remove a user from a channel. Destructive; requires confirmation code.",
    inputSchema: removeUserFromChannelShape,
  },
  wrapToolHandler(removeUserFromChannelSchema, removeUserFromChannel, "remove_user_from_channel_via_name_or_id")
);

// === Workspace & Users ===
server.registerTool(
  "list_users_not_for_id_lookup",
  {
    description: "List all workspace users. Use ONLY when the caller explicitly asks to view the user directory.",
    inputSchema: listUsersShape,
  },
  wrapToolHandler(listUsersSchema, listUsers, "list_users_not_for_id_lookup")
);

// === Scheduled Messages ===
server.registerTool(
  "list_scheduled_messages",
  {
    description: "List scheduled messages, optionally filtered by channel or user.",
    inputSchema: listScheduledMessagesShape,
  },
  wrapToolHandler(listScheduledMessagesSchema, listScheduledMessages, "list_scheduled_messages")
);

server.registerTool(
  "create_scheduled_message_via_name_or_id",
  {
    description: "Schedule a message for future delivery to a channel or user.",
    inputSchema: createScheduledMessageShape,
  },
  wrapToolHandler(createScheduledMessageSchema, createScheduledMessage, "create_scheduled_message_via_name_or_id")
);

server.registerTool(
  "edit_scheduled_message_via_name_or_id",
  {
    description: "Edit text, target, or send time of a scheduled message.",
    inputSchema: editScheduledMessageShape,
  },
  wrapToolHandler(editScheduledMessageSchema, editScheduledMessage, "edit_scheduled_message_via_name_or_id")
);

server.registerTool(
  "delete_scheduled_message_via_name_or_id",
  {
    description: "Delete a scheduled message before delivery. Destructive; requires confirmation code.",
    inputSchema: deleteScheduledMessageShape,
  },
  wrapToolHandler(deleteScheduledMessageSchema, deleteScheduledMessage, "delete_scheduled_message_via_name_or_id")
);

server.registerTool(
  "get_scheduled_message_via_name_or_id",
  {
    description: "Get details of a specific scheduled message by ID.",
    inputSchema: getScheduledMessageShape,
  },
  wrapToolHandler(getScheduledMessageSchema, getScheduledMessage, "get_scheduled_message_via_name_or_id")
);
// Kick off prefetch asynchronously so it doesn't block the client handshake
prefetchIdentifiers().catch(err => console.error("Prefetch failed:", err));

const transport = new StdioServerTransport();
await server.connect(transport);
