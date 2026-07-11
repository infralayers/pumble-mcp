import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const sendMessageShape = {
  channel: z.string().optional().describe("Channel name (provide this OR channelId)"),
  channelId: z.string().optional().describe("Channel ID (provide this OR channel)"),
  text: z.string().describe("The message text to send"),
  asBot: z.boolean().default(false).describe("Send as the bot identity instead of the API key's user"),
};

export const sendMessageSchema = z
  .object(sendMessageShape)
  .refine((v) => Boolean(v.channel) !== Boolean(v.channelId), {
    message: "Provide exactly one of `channel` or `channelId`",
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export async function sendMessage(input: SendMessageInput) {
  return pumbleRequest<{ id: string }>("/sendMessage", {
    method: "POST",
    body: input,
  });
}
