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
    description: "Send a message to a Pumble channel, as your own user by default. The server natively resolves fuzzy names to exact IDs.",
    inputSchema: sendMessageShape,
  },
  wrapToolHandler(sendMessageSchema, sendMessage)
);

server.registerTool(
  "pumble_list_messages_via_channel_name_or_id",
  {
    description: "List messages in a Pumble channel. The server natively resolves fuzzy names to exact IDs.",
    inputSchema: listMessagesShape,
  },
  wrapToolHandler(listMessagesSchema, listMessages)
);

server.registerTool(
  "pumble_edit_message",
  {
    description: "Edit the text of an existing Pumble message.",
    inputSchema: editMessageShape,
  },
  wrapToolHandler(editMessageSchema, editMessage)
);

server.registerTool(
  "pumble_list_channels",
  {
    description: "List all Pumble channels visible to the API key. Note: You do not need to use this tool to look up a channel before sending a message; all other tools natively accept fuzzy channel names and resolve them automatically.",
    inputSchema: {},
  },
  wrapToolHandler(listChannelsSchema, listChannels)
);

server.registerTool(
  "pumble_send_dm_via_name_email_or_id",
  {
    description: "Send a direct message to a person in Pumble, as your own user. Automatically resolves names and emails to user IDs, so you don't need to look them up first.",
    inputSchema: sendDmShape,
  },
  wrapToolHandler(sendDmSchema, sendDm)
);

server.registerTool(
  "pumble_send_group_dm_via_name_email_or_id",
  {
    description: "Send a direct message to a group of users in Pumble. Automatically resolves names and emails to user IDs.",
    inputSchema: sendGroupDmShape,
  },
  wrapToolHandler(sendGroupDmSchema, sendGroupDm)
);

server.registerTool(
  "pumble_list_users",
  {
    description: "List all users in the workspace to retrieve their details. Note: You do not need to use this tool to look up a user before sending a message; all other tools natively accept fuzzy names/emails and resolve them automatically.",
    inputSchema: {},
  },
  wrapToolHandler(listUsersSchema, listUsers)
);




server.registerTool(
  "pumble_search_messages",
  {
    description: "Search for messages across the Pumble workspace. Use this to discover message IDs. Automatically resolves names to IDs.",
    inputSchema: searchMessagesShape,
  },
  wrapToolHandler(searchMessagesSchema, searchMessages)
);

server.registerTool(

  "pumble_add_reaction",
  {
    description: "Add an emoji reaction to a message in Pumble.",
    inputSchema: addReactionShape,
  },
  wrapToolHandler(addReactionSchema, addReaction)
);

server.registerTool(
  "pumble_remove_reaction",
  {
    description: "Remove an emoji reaction from a message in Pumble.",
    inputSchema: removeReactionShape,
  },
  wrapToolHandler(removeReactionSchema, removeReaction)
);

server.registerTool(
  "pumble_get_channel_via_name_or_id",
  {
    description: "Look up a channel by its ID or Name.",
    inputSchema: getChannelShape,
  },
  wrapToolHandler(getChannelSchema, getChannel)
);

server.registerTool(

  "pumble_create_channel",
  {
    description: "Create a new channel.",
    inputSchema: createChannelShape,
  },
  wrapToolHandler(createChannelSchema, createChannel)
);

server.registerTool(
  "pumble_add_users_to_channel_via_name_or_id",
  {
    description: "Add users to a channel.",
    inputSchema: addUsersToChannelShape,
  },
  wrapToolHandler(addUsersToChannelSchema, addUsersToChannel)
);

server.registerTool(
  "pumble_remove_user_from_channel_via_name_or_id",
  {
    description: "Remove a user from a channel. This is a destructive operation and requires explicit confirmation.",
    inputSchema: removeUserFromChannelShape,
  },
  wrapToolHandler(removeUserFromChannelSchema, removeUserFromChannel)
);

server.registerTool(
  "pumble_reply_message_via_channel_name_or_id",
  {
    description: "Reply to a message within a channel, creating or continuing a thread. Accepts a channel name or ID and automatically resolves names to IDs.",
    inputSchema: replyMessageShape,
  },
  wrapToolHandler(replyMessageSchema, replyMessage)
);

server.registerTool(
  "pumble_list_thread_replies_via_channel_name_or_id",
  {
    description: "Fetch all replies for a given thread or parent message. Accepts a channel name or ID and automatically resolves names to IDs.",
    inputSchema: listThreadRepliesShape,
  },
  wrapToolHandler(listThreadRepliesSchema, listThreadReplies)
);

server.registerTool(
  "pumble_list_scheduled_messages",
  {
    description: "List scheduled messages in the workspace or filtered by channel or DM recipient. Use this to find scheduled message IDs.",
    inputSchema: listScheduledMessagesShape,
  },
  wrapToolHandler(listScheduledMessagesSchema, listScheduledMessages)
);

server.registerTool(
  "pumble_create_scheduled_message",
  {
    description: "Schedule a message to be published in a channel or Direct Message (DM) at a specified future date/time. Clarify with user whether target is a Channel or a DM before invoking.",
    inputSchema: createScheduledMessageShape,
  },
  wrapToolHandler(createScheduledMessageSchema, createScheduledMessage)
);

server.registerTool(
  "pumble_edit_scheduled_message",
  {
    description: "Edit the text or send time of an existing scheduled message.",
    inputSchema: editScheduledMessageShape,
  },
  wrapToolHandler(editScheduledMessageSchema, editScheduledMessage)
);

server.registerTool(
  "pumble_delete_scheduled_message",
  {
    description: "Cancel/delete a scheduled message. Requires explicit confirmation boolean.",
    inputSchema: deleteScheduledMessageShape,
  },
  wrapToolHandler(deleteScheduledMessageSchema, deleteScheduledMessage)
);

server.registerTool(
  "pumble_get_scheduled_message",
  {
    description: "Fetch a specific scheduled message's details by ID.",
    inputSchema: getScheduledMessageShape,
  },
  wrapToolHandler(getScheduledMessageSchema, getScheduledMessage)
);
const transport = new StdioServerTransport();
await server.connect(transport);
