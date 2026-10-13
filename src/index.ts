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


let lastExecutionErrorTime = 0;
let lastExecutionErrorMessage = "";

interface SecurityChallenge {
  token: string;
  expiresAt: number;
}
const activeChallenges = new Map<string, SecurityChallenge>();
const directoryToolFirstAttempts = new Set<string>();
function generateToken(): string {
  return `AUTH-${Math.floor(1000 + Math.random() * 9000)}`;
}

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

function wrapToolHandler<S extends z.ZodTypeAny>(
  schema: S,
  handler: (input: z.infer<S>) => Promise<any>,
  toolName: string = "tool"
) {
  return async (args: unknown) => {
    const now = Date.now();

    // 1. GLOBAL AGENT CASCADE COOLDOWN:
    // If an execution error occurred within the last 3 seconds, halt rapid automated retries
    if (now - lastExecutionErrorTime < 3000) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `🚨 CRITICAL SECURITY HALT: SYSTEM IN ERROR LOCKDOWN.\nAn execution error recently occurred ("${lastExecutionErrorMessage}").\nYou are strictly FORBIDDEN from executing ANY tools autonomously during cooldown.\nDO NOT attempt fallback tools, retries, or directory searches.\nYOU MUST IMMEDIATELY STOP CALLING TOOLS AND REPORT THE ISSUE TO THE USER FOR GUIDANCE.`,
          },
        ],
      };
    }

    // 2. SINGLE-STRIKE FRICTION GATE FOR BULK-READING TOOLS
    const isBulkReadingTool =
      toolName.includes("list_channels") ||
      toolName.includes("list_users") ||
      toolName.includes("list_messages");

    if (isBulkReadingTool) {
      if (!directoryToolFirstAttempts.has(toolName)) {
        directoryToolFirstAttempts.add(toolName);
        setTimeout(() => directoryToolFirstAttempts.delete(toolName), 45_000);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `⛔ BLOCKED: UNNECESSARY DIRECTORY SCAN ATTEMPTED.\nDO NOT CALL THIS TOOL FOR LOOKUPS OR ID RESOLUTION!— all action tools resolve names/slugs natively! Call target tool directly.\nIf the user explicitly requested a full workspace directory, retry this tool immediately to proceed.`,
            },
          ],
        };
      }

      // Second attempt within window: allow execution immediately
      directoryToolFirstAttempts.delete(toolName);
    }

    // 3. TOKEN CHALLENGE-RESPONSE GATE FOR DESTRUCTIVE TOOLS
    const isDestructiveTool =
      toolName.includes("remove_user") ||
      toolName.includes("delete_scheduled");

    if (isDestructiveTool) {
      const providedToken = (args as any)?.confirmationToken;
      const challenge = activeChallenges.get(toolName);

      const isAuthorized =
        providedToken &&
        challenge &&
        challenge.token === providedToken &&
        now < challenge.expiresAt;

      if (!isAuthorized) {
        const token = generateToken();
        activeChallenges.set(toolName, { token, expiresAt: now + 60_000 });

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `⚠️ SECURITY GATE: DESTRUCTIVE WORKSPACE ACTION INTERCEPTED.\nYou cannot execute destructive deletions or user removals autonomously.\nPresent this exact confirmation to the human user:\n"I am about to perform a destructive operation. If you intended this, please reply in chat with confirmation code ${token} to authorize it."\nDO NOT call this tool again until the human explicitly provides this confirmation code in their response.`,
            },
          ],
        };
      }

      // Token consumed and invalidated on successful authorization
      activeChallenges.delete(toolName);
    }

    try {
      const input = schema.parse(args);
      const result = await handler(input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { ok: true }) }] };
    } catch (error: any) {
      logStderr("Tool execution error:", error?.stack || error?.message || error);

      // Zod validation errors: Agent input mistake. Allow immediate self-correction!
      if (error instanceof z.ZodError) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: cleanErrorMessage(error) }],
        };
      }

      // Runtime / API / Resolution failures: Engage the 3-second global cooldown
      lastExecutionErrorTime = Date.now();
      lastExecutionErrorMessage = cleanErrorMessage(error);

      return {
        isError: true,
        content: [{ type: "text" as const, text: lastExecutionErrorMessage }],
      };
    }
  };
}

// === Messages & Threads ===
server.registerTool(
  "pumble_send_message_via_channel_name_or_id",
  {
    description: "Send a channel message. (NATIVE CHANNEL NAME RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: sendMessageShape,
  },
  wrapToolHandler(sendMessageSchema, sendMessage)
);

server.registerTool(
  "pumble_list_messages_via_channel_name_or_id",
  {
    description: "List messages in a channel. (NATIVE CHANNEL NAME RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: listMessagesShape,
  },
  wrapToolHandler(listMessagesSchema, listMessages, "pumble_list_messages")
);

server.registerTool(
  "pumble_edit_message",
  {
    description: "Edit a previously sent message. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: editMessageShape,
  },
  wrapToolHandler(editMessageSchema, editMessage)
);

server.registerTool(
  "pumble_send_dm_via_name_email_or_id",
  {
    description: "Send a direct message. (NATIVE NAME/EMAIL RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: sendDmShape,
  },
  wrapToolHandler(sendDmSchema, sendDm)
);

server.registerTool(
  "pumble_send_group_dm_via_names_emails_or_ids",
  {
    description: "Send a group direct message. (NATIVE NAME/EMAIL RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: sendGroupDmShape,
  },
  wrapToolHandler(sendGroupDmSchema, sendGroupDm)
);

server.registerTool(
  "pumble_get_my_info",
  {
    description: "Get profile information about the current authenticated user.",
    inputSchema: getMyInfoShape,
  },
  wrapToolHandler(getMyInfoSchema, getMyInfo)
);

server.registerTool(
  "pumble_list_user_groups",
  {
    description: "List all user groups in the workspace.",
    inputSchema: listUserGroupsShape,
  },
  wrapToolHandler(listUserGroupsSchema, listUserGroups)
);

server.registerTool(
  "pumble_update_my_custom_status",
  {
    description: "Update the custom status of the authenticated user.",
    inputSchema: updateCustomStatusShape,
  },
  wrapToolHandler(updateCustomStatusSchema, updateCustomStatus)
);

server.registerTool(
  "pumble_search_messages",
  {
    description: "Search messages across the workspace. (NATIVE USER RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: searchMessagesShape,
  },
  wrapToolHandler(searchMessagesSchema, searchMessages)
);

server.registerTool(
  "pumble_reply_message_via_channel_name_or_id",
  {
    description: "Reply to a message to create/continue a thread. (NATIVE CHANNEL NAME RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: replyMessageShape,
  },
  wrapToolHandler(replyMessageSchema, replyMessage)
);

server.registerTool(
  "pumble_list_thread_replies_via_channel_name_or_id",
  {
    description: "Fetch all replies for a thread. (NATIVE CHANNEL NAME RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: listThreadRepliesShape,
  },
  wrapToolHandler(listThreadRepliesSchema, listThreadReplies)
);

// === Reactions ===
server.registerTool(
  "pumble_add_reaction",
  {
    description: "Add a reaction to a message. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: addReactionShape,
  },
  wrapToolHandler(addReactionSchema, addReaction)
);

server.registerTool(
  "pumble_remove_reaction",
  {
    description: "Remove a reaction from a message. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: removeReactionShape,
  },
  wrapToolHandler(removeReactionSchema, removeReaction)
);

// === Channels ===
server.registerTool(
  "pumble_list_channels_only_when_user_calls",
  {
    description: "List all visible channels. (READ-ONLY - DO NOT CALL FOR ID LOOKUP: All message and action tools natively resolve channel names and slugs directly into IDs. Only call if the human user explicitly asks to view the channel directory.)",
    inputSchema: listChannelsShape,
  },
  wrapToolHandler(listChannelsSchema, listChannels, "pumble_list_channels")
);

server.registerTool(
  "pumble_get_channel_detail_via_channel_name_or_id",
  {
    description: "Look up a channel's details, accetps hypen and spaces. (READ-ONLY - DO NOT USE FOR MESSAGE ROUTING)",
    inputSchema: getChannelShape,
  },
  wrapToolHandler(getChannelSchema, getChannel)
);

server.registerTool(

  "pumble_create_channel",
  {
    description: "Create a new public or private channel.",
    inputSchema: createChannelShape,
  },
  wrapToolHandler(createChannelSchema, createChannel)
);

server.registerTool(
  "pumble_add_users_to_channel_via_emails_channel_name_or_id",
  {
    description: "Add users to a channel. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: addUsersToChannelShape,
  },
  wrapToolHandler(addUsersToChannelSchema, addUsersToChannel)
);

server.registerTool(
  "pumble_remove_user_from_channel_via_email_channel_name_or_id",
  {
    description: "Remove a user from a channel. (NATIVE RESOLUTION - DANGER: REQUIRES EXPLICIT USER CONFIRMATION)",
    inputSchema: removeUserFromChannelShape,
  },
  wrapToolHandler(removeUserFromChannelSchema, removeUserFromChannel, "pumble_remove_user_from_channel")
);

// === Workspace & Users ===
server.registerTool(
  "pumble_list_users_not_for_id_lookup",
  {
    description: "List all workspace users. (READ-ONLY - DO NOT CALL FOR ID LOOKUP: All message and action tools natively resolve user names and emails directly into IDs. Only call if the human user explicitly asks to view the user list.)",
    inputSchema: listUsersShape,
  },
  wrapToolHandler(listUsersSchema, listUsers, "pumble_list_users")
);

// === Scheduled Messages ===
server.registerTool(
  "pumble_list_scheduled_messages",
  {
    description: "List all scheduled messages. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: listScheduledMessagesShape,
  },
  wrapToolHandler(listScheduledMessagesSchema, listScheduledMessages)
);

server.registerTool(
  "pumble_create_scheduled_message_via_name_or_id",
  {
    description: "Schedule a message for the future. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: createScheduledMessageShape,
  },
  wrapToolHandler(createScheduledMessageSchema, createScheduledMessage)
);

server.registerTool(
  "pumble_edit_scheduled_message_via_name_or_id",
  {
    description: "Edit a scheduled message. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: editScheduledMessageShape,
  },
  wrapToolHandler(editScheduledMessageSchema, editScheduledMessage)
);

server.registerTool(
  "pumble_delete_scheduled_message_via_name_or_id",
  {
    description: "Delete a scheduled message. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: deleteScheduledMessageShape,
  },
  wrapToolHandler(deleteScheduledMessageSchema, deleteScheduledMessage, "pumble_delete_scheduled_message")
);

server.registerTool(
  "pumble_get_scheduled_message_via_name_or_id",
  {
    description: "Fetch a scheduled message. (READ-ONLY)",
    inputSchema: getScheduledMessageShape,
  },
  wrapToolHandler(getScheduledMessageSchema, getScheduledMessage)
);
// Kick off prefetch asynchronously so it doesn't block the client handshake
prefetchIdentifiers().catch(err => console.error("Prefetch failed:", err));

const transport = new StdioServerTransport();
await server.connect(transport);
