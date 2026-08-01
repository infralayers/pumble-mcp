import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const deleteScheduledMessageShape = {
  scheduledMessageId: z.string().min(1).describe("The exact ID of the scheduled message to delete. If unknown, use listScheduledMessages to find it first. (Do not guess)"),
  confirm: z.literal(true).describe("Explicit confirmation boolean. Must be true to confirm deletion. (Do not guess)"),
};

export const deleteScheduledMessageSchema = z.object(deleteScheduledMessageShape);

export type DeleteScheduledMessageInput = z.infer<typeof deleteScheduledMessageSchema>;

export async function deleteScheduledMessage(input: DeleteScheduledMessageInput) {
  return pumbleRequest<{ ok?: boolean }>("/deleteScheduledMessage", {
    method: "DELETE",
    query: {
      scheduledMessageId: input.scheduledMessageId,
    },
  });
}
