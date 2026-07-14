import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { sendMessage, sendMessageSchema, sendMessageShape } from "./tools/sendMessage.js";
import { listMessages, listMessagesSchema, listMessagesShape } from "./tools/listMessages.js";
import { editMessage, editMessageShape } from "./tools/editMessage.js";
import { listChannels } from "./tools/listChannels.js";
import { sendDm, sendDmSchema, sendDmShape } from "./tools/sendDm.js";
import { listUsers } from "./tools/listUsers.js";
import { addReaction, addReactionShape } from "./tools/addReaction.js";
import { removeReaction, removeReactionShape } from "./tools/removeReaction.js";

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
      "List all Pumble channels visible to the API key, including DMs (channelType DIRECT) and group DMs. Use the channel's id with pumble_list_messages to read a DM conversation.",
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
  "pumble_add_reaction",
  {
    description: "Add an emoji reaction to a message in Pumble.",
    inputSchema: addReactionShape,
  },
  async (args) => {
    const result = await addReaction(args as any);
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
    const result = await removeReaction(args as any);
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
