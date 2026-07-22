import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const removeReactionShape = {
  messageId: z.string().describe("The ID of the message to remove reaction from"),
  channelId: z.string().describe("The ID of the channel the message is in"),
  reaction: z.string().describe("The emoji code to remove (e.g., :thumbsup:)"),
};

export const removeReactionSchema = z.object(removeReactionShape);
export type RemoveReactionInput = z.infer<typeof removeReactionSchema>;

export async function removeReaction(input: RemoveReactionInput) {
  return pumbleRequest<unknown>("/removeReaction", {
    method: "DELETE",
    query: {
      messageId: input.messageId,
      channelId: input.channelId,
      reaction: input.reaction
    },
  });
}
