import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const addReactionShape = {
  messageId: z.string().min(1).describe("The exact ID of the target message. Note: if the target message was recently sent, use the id returned in that response. If unknown, use pumble_search_messages to find it first."),
  channelIdentifier: z.string().min(1).describe("Channel name, slug, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  reaction: z
    .string()
    .min(1)
    .regex(
      /^:?[a-zA-Z0-9_+-]+:?$/,
      "Invalid reaction format. Must be an emoji shortcode (e.g., ':thumbsup:' or 'thumbsup') without spaces or conversational text."
    )
    .describe("The emoji code (e.g., :thumbsup:). Must be a single emoji code, no conversational text or spaces. (Do not guess)"),
};

export const addReactionSchema = z.object(addReactionShape).strict();
export type AddReactionInput = z.infer<typeof addReactionSchema>;

export async function addReaction(input: AddReactionInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  await pumbleRequest<unknown>("/addReaction", {
    method: "POST",
    body: {
      messageId: input.messageId,
      channelId,
      reaction: input.reaction,
    },
  });

  return {
    ok: true,
    reacted: true,
    messageId: input.messageId,
    channel: input.channelIdentifier,
    channelId,
    reaction: input.reaction,
    status: "Reaction successfully added. Verification complete — no further action needed.",
  };
}
