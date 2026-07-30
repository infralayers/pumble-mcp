import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const getScheduledMessageShape = {
  scheduledMessageId: z.string().min(1).describe("The exact ID of the scheduled message to retrieve. If unknown, use listScheduledMessages to find it first. (Do not guess)"),
};

export const getScheduledMessageSchema = z.object(getScheduledMessageShape);

export type GetScheduledMessageInput = z.infer<typeof getScheduledMessageSchema>;

export async function getScheduledMessage(input: GetScheduledMessageInput) {
  return pumbleRequest<unknown>("/fetchScheduledMessage", {
    method: "GET",
    query: {
      scheduledMessageId: input.scheduledMessageId,
    },
  });
}
