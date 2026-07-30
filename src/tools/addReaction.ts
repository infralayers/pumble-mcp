import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const addReactionShape = {
  messageId: z.string().min(1).describe("The exact ID of the message to react to. If unknown, use pumble_search_messages to find it first. (Do not guess)"),
  channelIdentifier: z.string().min(1).describe("The name or ID of the channel the message is in. (Do not guess)"),
  reaction: z.string().min(1).describe("The emoji code (e.g., :thumbsup:). (Do not guess)"),
};

export const addReactionSchema = z.object(addReactionShape);
export type AddReactionInput = z.infer<typeof addReactionSchema>;

export async function addReaction(input: AddReactionInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  return pumbleRequest<unknown>("/addReaction", {
    method: "POST",
    body: {
      messageId: input.messageId,
      channelId,
      reaction: input.reaction,
    },
  });
}
