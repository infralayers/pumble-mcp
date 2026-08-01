import { pumbleRequest } from "../pumbleClient.js";

/**
 * Used by editScheduledMessage, and deliberately not registered as a tool:
 * `pumble_list_scheduled_messages` already returns whole messages.
 */
export async function getScheduledMessage(input: { scheduledMessageId: string }) {
  return pumbleRequest<unknown>("/fetchScheduledMessage", {
    method: "GET",
    query: {
      scheduledMessageId: input.scheduledMessageId,
    },
  });
}
