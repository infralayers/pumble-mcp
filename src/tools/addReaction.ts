import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const addReactionShape = {
  messageId: z.string().describe("The ID of the message to react to"),
  channelId: z.string().describe("The ID of the channel the message is in"),
  reaction: z.string().describe("The emoji code (e.g., :thumbsup:)"),
};

export const addReactionSchema = z.object(addReactionShape);
export type AddReactionInput = z.infer<typeof addReactionSchema>;

export async function addReaction(input: AddReactionInput) {
  return pumbleRequest<unknown>("/addReaction", {
    method: "POST",
    body: input,
  });
}
