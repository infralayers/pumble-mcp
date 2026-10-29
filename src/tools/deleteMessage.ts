import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const deleteMessageShape = {
  messageId: z
    .string()
    .min(1)
    .describe("The unique identifier of the message to delete. If not provided, MUST ASK. DO NOT GUESS."),
  channelIdentifier: z
    .string()
    .min(1)
    .describe("Channel name, slug, or ID where the message is located. If not provided, MUST ASK. DO NOT GUESS."),
  confirm: z.literal(true, {
    errorMap: () => ({ message: "You MUST explicitly set confirm: true to perform this destructive operation" }),
  }).describe("Explicit confirmation boolean. Must be true to confirm deletion. (Do not guess)"),
  confirmationToken: z.string().optional().describe("One-time security confirmation token authorized by the caller."),
};

export const deleteMessageSchema = z.object(deleteMessageShape).strict();

export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;

export async function deleteMessage(input: DeleteMessageInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);

  await pumbleRequest<unknown>("/deleteMessage", {
    method: "DELETE",
    query: {
      messageId: input.messageId,
      channelId,
    },
  });

  return {
    ok: true,
    deleted: true,
    messageId: input.messageId,
    channel: input.channelIdentifier,
    channelId,
    status: "Message successfully deleted. Verification complete — no further action needed.",
  };
}
