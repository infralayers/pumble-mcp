import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const editMessageShape = {
  messageId: z.string().min(1).describe("The exact ID of the message to edit. If unknown, use pumble_search_messages to find it first. (Do not guess)"),
  channelIdentifier: z.string().min(1).describe("The name or ID of the channel the message is in. (Do not guess)"),
  text: z.string().min(1).describe("The new message text. (Do not guess)"),
};

export const editMessageSchema = z.object(editMessageShape);

export type EditMessageInput = z.infer<typeof editMessageSchema>;

export async function editMessage(input: EditMessageInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  return pumbleRequest<void>("/editMessage", {
    method: "POST",
    body: {
      messageId: input.messageId,
      channelId,
      text: input.text,
    },
  });
}
