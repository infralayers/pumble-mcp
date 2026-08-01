import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const replyMessageShape = {
  messageId: z.string().min(1).describe("The exact ID of the message to reply to. If unknown, use pumble_search_messages to find it first."),
  channelIdentifier: z.string().min(1).describe("Channel name or ID the message is in"),
  text: z.string().min(1).describe("The reply message text"),
  asBot: z.boolean().default(false).describe("Send as the bot identity instead of the API key's user"),
};

export const replyMessageSchema = z.object(replyMessageShape);

export type ReplyMessageInput = z.infer<typeof replyMessageSchema>;

export async function replyMessage(input: ReplyMessageInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  return pumbleRequest<{ id: string }>("/sendReply", {
    method: "POST",
    body: {
      messageId: input.messageId,
      channelId,
      text: input.text,
      asBot: input.asBot,
    },
  });
}
