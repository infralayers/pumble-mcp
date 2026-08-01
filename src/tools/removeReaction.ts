import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const removeReactionShape = {
  messageId: z.string().min(1).describe("The exact ID of the message to remove reaction from. If unknown, use pumble_search_messages to find it first. (Do not guess)"),
  channelIdentifier: z.string().min(1).describe("The name or ID of the channel the message is in. (Do not guess)"),
  reaction: z.string().min(1).describe("The emoji code to remove (e.g., :thumbsup:). (Do not guess)"),
};

export const removeReactionSchema = z.object(removeReactionShape);
export type RemoveReactionInput = z.infer<typeof removeReactionSchema>;

export async function removeReaction(input: RemoveReactionInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  return pumbleRequest<unknown>("/removeReaction", {
    method: "DELETE",
    query: {
      messageId: input.messageId,
      channelId,
      reaction: input.reaction
    },
  });
}
