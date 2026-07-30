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
import { getMyInfo, getMyInfoSchema, getMyInfoShape } from "./tools/getMyInfo.js";
import { listUserGroups, listUserGroupsSchema, listUserGroupsShape } from "./tools/listUserGroups.js";
import { updateCustomStatus, updateCustomStatusSchema, updateCustomStatusShape } from "./tools/updateCustomStatus.js";

if (!process.env.PUMBLE_API_KEY) {
  console.error("PUMBLE_API_KEY environment variable is not set");
  process.exit(1);
}

const server = new McpServer({ name: "pumble-mcp", version: "0.1.0" });

// Phase 3: Observability & Error Handling
export function logStderr(message: string, ...args: any[]) {
  process.stderr.write(`[pumble-mcp] ${message} ${args.length ? JSON.stringify(args) : ""}\n`);
}

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
  "pumble_send_message",
  {
    description: "Send a message to a Pumble channel, as your own user by default. The server natively resolves fuzzy names to exact IDs.",
    inputSchema: sendMessageShape,
  },
  wrapToolHandler(sendMessageSchema, sendMessage)
);

server.registerTool(
  "pumble_list_messages",
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
    description: "List all Pumble channels visible to the API key. CRITICAL: DO NOT use this tool to look up a channel before sending a message. All other tools natively accept fuzzy channel names and resolve them automatically. Only use this tool if the user explicitly asks to see a list of channels.",
    inputSchema: {},
  },
  wrapToolHandler(listChannelsSchema, listChannels)
);

server.registerTool(
  "pumble_send_dm",
  {
    description: "Send a direct message to a person in Pumble, as your own user. Automatically resolves names and emails to user IDs, so you don't need to look them up first.",
    inputSchema: sendDmShape,
  },
  wrapToolHandler(sendDmSchema, sendDm)
);

server.registerTool(
  "pumble_send_group_dm",
  {
    description: "Send a direct message to a group of users in Pumble. CRITICAL RULE: You MUST NEVER infer, guess, or hallucinate missing information. Automatically resolves names and emails to user IDs.",
    inputSchema: sendGroupDmShape,
  },
  wrapToolHandler(sendGroupDmSchema, sendGroupDm)
);

server.registerTool(
  "pumble_list_users",
  {
    description: "List all users in the workspace to retrieve their details. CRITICAL: DO NOT use this tool to look up a user before sending a message. All other tools natively accept fuzzy names/emails and resolve them automatically. Only use this tool if the user explicitly asks for a list of users.",
    inputSchema: {},
  },
  wrapToolHandler(listUsersSchema, listUsers)
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
    inputSchema: listUserGroupsShape || {},
  },
  wrapToolHandler(listUserGroupsSchema, listUserGroups)
);

server.registerTool(
  "pumble_update_custom_status",
  {
    description: "Update the custom status of the authenticated user.",
    inputSchema: updateCustomStatusShape,
  },
  wrapToolHandler(updateCustomStatusSchema, updateCustomStatus)
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
  "pumble_get_channel",
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
  "pumble_add_users_to_channel",
  {
    description: "Add users to a channel.",
    inputSchema: addUsersToChannelShape,
  },
  wrapToolHandler(addUsersToChannelSchema, addUsersToChannel)
);

server.registerTool(
  "pumble_remove_user_from_channel",
  {
    description: "Remove a user from a channel. This is a destructive operation and requires explicit confirmation.",
    inputSchema: removeUserFromChannelShape,
  },
  wrapToolHandler(removeUserFromChannelSchema, removeUserFromChannel)
);

server.registerTool(
  "pumble_reply_message",
  {
    description: "Reply to a message within a channel, creating or continuing a thread. Accepts a channel name or ID and automatically resolves names to IDs.",
    inputSchema: replyMessageShape,
  },
  wrapToolHandler(replyMessageSchema, replyMessage)
);

server.registerTool(
  "pumble_list_thread_replies",
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
