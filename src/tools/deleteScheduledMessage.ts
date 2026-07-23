import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const deleteScheduledMessageShape = {
  scheduledMessageId: z.string().describe("The ID of the scheduled message to delete"),
  confirm: z.boolean().describe("Explicit confirmation boolean. Must be true to confirm deletion."),
};

export const deleteScheduledMessageSchema = z.object(deleteScheduledMessageShape).refine((v) => v.confirm === true, {
  message: "Confirmation is required to delete a scheduled message. Set `confirm` to true.",
});

export type DeleteScheduledMessageInput = z.infer<typeof deleteScheduledMessageSchema>;

export async function deleteScheduledMessage(input: DeleteScheduledMessageInput) {
  return pumbleRequest<{ ok?: boolean }>("/deleteScheduledMessage", {
    method: "DELETE",
    body: {
      scheduledMessageId: input.scheduledMessageId,
    },
  });
}
