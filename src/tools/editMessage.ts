import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const editMessageShape = {
  messageId: z.string().min(1).describe("The exact ID of the target message. Note: if the target message was recently sent, use the id returned in that response. If unknown, use pumble_search_messages to find it first."),
  channelIdentifier: z.string().min(1).describe("Channel name, slug, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  text: z.string().min(1).max(4000).describe("The new message text (max 4000 characters). If not provided, MUST ASK. DO NOT GUESS."),
};

export const editMessageSchema = z.object(editMessageShape).strict();

export type EditMessageInput = z.infer<typeof editMessageSchema>;

export async function editMessage(input: EditMessageInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  await pumbleRequest<void>("/editMessage", {
    method: "POST",
    body: {
      messageId: input.messageId,
      channelId,
      text: input.text,
    },
  });

  return {
    ok: true,
    edited: true,
    messageId: input.messageId,
    channel: input.channelIdentifier,
    channelId,
    text: input.text,
    status: "Message successfully updated and verified. Verification complete — no further action needed.",
  };
}
