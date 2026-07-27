import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { sendMessage, sendMessageSchema, sendMessageShape } from "./tools/sendMessage.js";
import { listMessages, listMessagesSchema, listMessagesShape } from "./tools/listMessages.js";
import { editMessage, editMessageShape } from "./tools/editMessage.js";
import { listChannels } from "./tools/listChannels.js";
import { sendDm, sendDmSchema, sendDmShape } from "./tools/sendDm.js";
import { listUsers } from "./tools/listUsers.js";
import { getChannel, getChannelSchema, getChannelShape } from "./tools/getChannel.js";
import { createChannel, createChannelSchema, createChannelShape } from "./tools/createChannel.js";
import { addUsersToChannel, addUsersToChannelSchema, addUsersToChannelShape } from "./tools/addUsersToChannel.js";
import { removeUserFromChannel, removeUserFromChannelSchema, removeUserFromChannelShape } from "./tools/removeUserFromChannel.js";
import { searchMessages, searchMessagesSchema, searchMessagesShape } from "./tools/searchMessages.js";
import { addReaction, addReactionShape } from "./tools/addReaction.js";
import { removeReaction, removeReactionShape } from "./tools/removeReaction.js";
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

server.registerTool(
  "pumble_send_message",
  {
    description: "Send a message to a Pumble channel, as your own user by default.",
    inputSchema: sendMessageShape,
  },
  async (args) => {
    const input = sendMessageSchema.parse(args);
    const result = await sendMessage(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_list_messages",
  {
    description: "List messages in a Pumble channel.",
    inputSchema: listMessagesShape,
  },
  async (args) => {
    const input = listMessagesSchema.parse(args);
    const result = await listMessages(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_edit_message",
  {
    description: "Edit the text of an existing Pumble message.",
    inputSchema: editMessageShape,
  },
  async (args) => {
    const result = await editMessage(args);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  },
);

server.registerTool(
  "pumble_list_channels",
  {
    description:
      "List all Pumble channels visible to the API key, and mention their type (public/private), including DMs (channelType DIRECT) and group DMs. Use the channel's id with pumble_list_messages to read a DM conversation.",
    inputSchema: {},
  },
  async () => {
    const result = await listChannels({});
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_send_dm",
  {
    description:
      "Send a direct message to a person in Pumble, as your own user. Use pumble_list_users to find their userId/email first if unknown.",
    inputSchema: sendDmShape,
  },
  async (args) => {
    const input = sendDmSchema.parse(args);
    const result = await sendDm(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_list_users",
  {
    description:
      "List all people in the Pumble workspace (id, name, email). Use this to resolve a person's userId for pumble_send_dm, or find their DM channelId via pumble_list_channels (channelType DIRECT) to read a conversation with pumble_list_messages.",
    inputSchema: {},
  },
  async () => {
    const result = await listUsers({});
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_get_my_info",
  {
    description: "Get profile information about the current authenticated user.",
    inputSchema: getMyInfoShape,
  },
  async (args) => {
    const input = getMyInfoSchema.parse(args);
    const result = await getMyInfo(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_list_user_groups",
  {
    description: "List all user groups in the workspace.",
    inputSchema: listUserGroupsShape,
  },
  async (args) => {
    const input = listUserGroupsSchema.parse(args);
    const result = await listUserGroups(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_update_custom_status",
  {
    description: "Update the custom status of the authenticated user.",
    inputSchema: updateCustomStatusShape,
  },
  async (args) => {
    const input = updateCustomStatusSchema.parse(args);
    const result = await updateCustomStatus(input);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  },
);

server.registerTool(
  "pumble_search_messages",
  {
    description: "Search for messages across the Pumble workspace. You can filter by text, fromUser (name/email/ID), or inChannel (name/ID). Automatically resolves names to IDs.",
    inputSchema: searchMessagesShape,
  },
  async (args) => {
    const input = searchMessagesSchema.parse(args);
    const result = await searchMessages(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_add_reaction",
  {
    description: "Add an emoji reaction to a message in Pumble.",
    inputSchema: addReactionShape,
  },
  async (args) => {
    const result = await addReaction(args);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  },
);

server.registerTool(
  "pumble_remove_reaction",
  {
    description: "Remove an emoji reaction from a message in Pumble.",
    inputSchema: removeReactionShape,
  },
  async (args) => {
    const result = await removeReaction(args);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  },
);

server.registerTool(
  "pumble_get_channel",
  {
    description: "Look up a channel by its ID or Name.",
    inputSchema: getChannelShape,
  },
  async (args) => {
    const input = getChannelSchema.parse(args);
    const result = await getChannel(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_create_channel",
  {
    description: "Create a new channel.",
    inputSchema: createChannelShape,
  },
  async (args) => {
    const input = createChannelSchema.parse(args);
    const result = await createChannel(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_add_users_to_channel",
  {
    description: "Add users to a channel.",
    inputSchema: addUsersToChannelShape,
  },
  async (args) => {
    const input = addUsersToChannelSchema.parse(args);
    const result = await addUsersToChannel(input);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  },
);

server.registerTool(
  "pumble_remove_user_from_channel",
  {
    description: "Remove a user from a channel. This is a destructive operation and requires explicit confirmation.",
    inputSchema: removeUserFromChannelShape,
  },
  async (args) => {
    const input = removeUserFromChannelSchema.parse(args);
    const result = await removeUserFromChannel(input);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  },
);

server.registerTool(
  "pumble_reply_message",
  {
    description: "Reply to a message within a channel, creating or continuing a thread. Accepts a channel name or ID and automatically resolves names to IDs.",
    inputSchema: replyMessageShape,
  },
  async (args) => {
    const input = replyMessageSchema.parse(args);
    const result = await replyMessage(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_list_thread_replies",
  {
    description: "Fetch all replies for a given thread or parent message. Accepts a channel name or ID and automatically resolves names to IDs.",
    inputSchema: listThreadRepliesShape,
  },
  async (args) => {
    const input = listThreadRepliesSchema.parse(args);
    const result = await listThreadReplies(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_list_scheduled_messages",
  {
    description: "List scheduled messages in the workspace or filtered by channel or DM recipient (userId/email).",
    inputSchema: listScheduledMessagesShape,
  },
  async (args) => {
    const input = listScheduledMessagesSchema.parse(args);
    const result = await listScheduledMessages(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_create_scheduled_message",
  {
    description:
      "Schedule a message to be published in a channel or Direct Message (DM) at a specified future date/time." +
      "Clarify with user whether target is a Channel or a DM before invoking.",
    inputSchema: createScheduledMessageShape,
  },
  async (args) => {
    const input = createScheduledMessageSchema.parse(args);
    const result = await createScheduledMessage(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "pumble_edit_scheduled_message",
  {
    description: "Edit the text or send time of an existing scheduled message.",
    inputSchema: editScheduledMessageShape,
  },
  async (args) => {
    const input = editScheduledMessageSchema.parse(args);
    const result = await editScheduledMessage(input);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  },
);

server.registerTool(
  "pumble_delete_scheduled_message",
  {
    description: "Cancel/delete a scheduled message. Requires explicit confirmation boolean.",
    inputSchema: deleteScheduledMessageShape,
  },
  async (args) => {
    const input = deleteScheduledMessageSchema.parse(args);
    const result = await deleteScheduledMessage(input);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
