import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getScheduledMessage, getScheduledMessageSchema, getScheduledMessageShape } from "./tools/getScheduledMessage.js";

import { sendMessage, sendMessageSchema, sendMessageShape } from "./tools/sendMessage.js";
import { listMessages, listMessagesSchema, listMessagesShape } from "./tools/listMessages.js";
import { editMessage, editMessageSchema, editMessageShape } from "./tools/editMessage.js";
import { listChannels, listChannelsSchema } from "./tools/listChannels.js";
import { sendDm, sendDmSchema, sendDmShape } from "./tools/sendDm.js";
import { sendGroupDm, sendGroupDmSchema, sendGroupDmShape } from "./tools/sendGroupDm.js";
import { listUsers, listUsersSchema } from "./tools/listUsers.js";
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


function wrapToolHandler<S extends z.ZodTypeAny>(
  schema: S,
  handler: (input: z.infer<S>) => Promise<any>
) {
  return async (args: unknown) => {
    try {
      const input = schema.parse(args);
      const result = await handler(input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { ok: true }) }] };
    } catch (error: any) {
      logStderr("Tool execution error:", error?.message || error);
      
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(
          (issue) => `Field '${issue.path.join(".")}': ${issue.message}`
        );
        errorMessage = `Validation Error(s):\n${issues.join("\n")}`;
      }

      return {
        isError: true,
        content: [{ type: "text" as const, text: errorMessage }],
      };
    }
  };
}

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
  wrapToolHandler(listMessagesSchema, listMessages)
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
  "pumble_list_channels",
  {
    description: "List all visible channels. (READ-ONLY - DO NOT USE FOR MESSAGE ROUTING)",
    inputSchema: {},
  },
  wrapToolHandler(listChannelsSchema, listChannels)
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
  "pumble_send_group_dm_via_name_email_or_id",
  {
    description: "Send a group direct message. (NATIVE NAME/EMAIL RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: sendGroupDmShape,
  },
  wrapToolHandler(sendGroupDmSchema, sendGroupDm)
);

server.registerTool(
  "pumble_list_users",
  {
    description: "List all workspace users. (READ-ONLY - DO NOT USE FOR MESSAGE ROUTING)",
    inputSchema: {},
  },
  wrapToolHandler(listUsersSchema, listUsers)
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

server.registerTool(
  "pumble_get_channel_via_name_or_id",
  {
    description: "Look up a channel's details. (READ-ONLY - DO NOT USE FOR MESSAGE ROUTING)",
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
  "pumble_add_users_to_channel_via_name_or_id",
  {
    description: "Add users to a channel. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: addUsersToChannelShape,
  },
  wrapToolHandler(addUsersToChannelSchema, addUsersToChannel)
);

server.registerTool(
  "pumble_remove_user_from_channel_via_name_or_id",
  {
    description: "Remove a user from a channel. (NATIVE RESOLUTION - DANGER: REQUIRES EXPLICIT USER CONFIRMATION)",
    inputSchema: removeUserFromChannelShape,
  },
  wrapToolHandler(removeUserFromChannelSchema, removeUserFromChannel)
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

server.registerTool(
  "pumble_list_scheduled_messages",
  {
    description: "List all scheduled messages. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: listScheduledMessagesShape,
  },
  wrapToolHandler(listScheduledMessagesSchema, listScheduledMessages)
);

server.registerTool(
  "pumble_create_scheduled_message",
  {
    description: "Schedule a message for the future. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: createScheduledMessageShape,
  },
  wrapToolHandler(createScheduledMessageSchema, createScheduledMessage)
);

server.registerTool(
  "pumble_edit_scheduled_message",
  {
    description: "Edit a scheduled message. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: editScheduledMessageShape,
  },
  wrapToolHandler(editScheduledMessageSchema, editScheduledMessage)
);

server.registerTool(
  "pumble_delete_scheduled_message",
  {
    description: "Delete a scheduled message. (NATIVE RESOLUTION - NO LOOKUP REQUIRED)",
    inputSchema: deleteScheduledMessageShape,
  },
  wrapToolHandler(deleteScheduledMessageSchema, deleteScheduledMessage)
);

server.registerTool(
  "pumble_get_scheduled_message",
  {
    description: "Fetch a scheduled message. (READ-ONLY)",
    inputSchema: getScheduledMessageShape,
  },
  wrapToolHandler(getScheduledMessageSchema, getScheduledMessage)
);
const transport = new StdioServerTransport();
await server.connect(transport);
