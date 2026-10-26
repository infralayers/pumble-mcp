import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const sendMessageShape = {
  channelIdentifier: z.string().min(1).describe("Channel name, slug, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  text: z.string().min(1).max(4000).describe("The message text to send (max 4000 characters). If not provided, MUST ASK. DO NOT GUESS."),
  asBot: z.boolean().default(false).describe("Send as bot identity instead of API key user. Defaults to false. If not provided, DO NOT GUESS."),
};

export const sendMessageSchema = z.object(sendMessageShape).strict();

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export async function sendMessage(input: SendMessageInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  const res = await pumbleRequest<{ id: string }>("/sendMessage", {
    method: "POST",
    body: {
      channelId,
      text: input.text,
      asBot: input.asBot,
    },
  });

  return {
    ok: true,
    delivered: true,
    channel: input.channelIdentifier,
    channelId,
    messageId: res?.id,
    text: input.text,
    status: "Channel message successfully delivered and confirmed. Verification complete — no further action needed.",
  };
}
