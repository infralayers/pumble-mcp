import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const replyMessageShape = {
  messageId: z.string().describe("The ID of the parent message to reply to"),
  channelId: z.string().describe("The ID of the channel the message is in"),
  text: z.string().describe("The reply message text"),
  asBot: z.boolean().default(false).describe("Send as the bot identity instead of the API key's user"),
};

export const replyMessageSchema = z.object(replyMessageShape);

export type ReplyMessageInput = z.infer<typeof replyMessageSchema>;

export async function replyMessage(input: ReplyMessageInput) {
  return pumbleRequest<{ id: string }>("/sendReply", {
    method: "POST",
    body: input,
  });
}
