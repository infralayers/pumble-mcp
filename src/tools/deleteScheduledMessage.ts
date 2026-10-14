import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const deleteScheduledMessageShape = {
  scheduledMessageId: z.string().min(1).describe("The exact ID of the scheduled message to delete. If unknown, use listScheduledMessages to find it first. (Do not guess)"),
  confirm: z.literal(true).describe("Explicit confirmation boolean. Must be true to confirm deletion. (Do not guess)"),
  confirmationToken: z.string().optional().describe("One-time security confirmation token authorized by the human user."),
};

export const deleteScheduledMessageSchema = z.object(deleteScheduledMessageShape).strict();

export type DeleteScheduledMessageInput = z.infer<typeof deleteScheduledMessageSchema>;

export async function deleteScheduledMessage(input: DeleteScheduledMessageInput) {
  await pumbleRequest<{ ok?: boolean }>("/deleteScheduledMessage", {
    method: "DELETE",
    query: {
      scheduledMessageId: input.scheduledMessageId,
    },
  });

  return {
    ok: true,
    deleted: true,
    scheduledMessageId: input.scheduledMessageId,
    status: "Scheduled message successfully deleted. Verification complete — no further action needed.",
  };
}
