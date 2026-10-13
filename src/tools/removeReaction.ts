import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const removeReactionShape = {
  messageId: z.string().min(1).describe("The exact ID of the message to remove reaction from. If unknown, use pumble_search_messages to find it first. (Do not guess)"),
  channelIdentifier: z.string().min(1).describe("Channel name, slug, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  reaction: z
    .string()
    .min(1)
    .regex(
      /^:?[a-zA-Z0-9_+-]+:?$/,
      "Invalid reaction format. Must be an emoji shortcode (e.g., ':thumbsup:' or 'thumbsup') without spaces or conversational text."
    )
    .describe("The emoji code to remove (e.g., :thumbsup:). Must be a single emoji code, no conversational text or spaces. (Do not guess)"),
};

export const removeReactionSchema = z.object(removeReactionShape).strict();
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
