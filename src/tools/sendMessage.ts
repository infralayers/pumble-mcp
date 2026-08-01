import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const sendMessageShape = {
  channelIdentifier: z.string().min(1).describe("The name or ID of the channel. (Do not guess)"),
  text: z.string().min(1).describe("The message text to send. (Do not guess)"),
  asBot: z.boolean().default(false).describe("Send as the bot identity instead of the API key's user"),
};

export const sendMessageSchema = z.object(sendMessageShape);

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export async function sendMessage(input: SendMessageInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  return pumbleRequest<{ id: string }>("/sendMessage", {
    method: "POST",
    body: {
      channelId,
      text: input.text,
      asBot: input.asBot,
    },
  });
}
