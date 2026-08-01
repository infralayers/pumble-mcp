import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveDestinationChannelId } from "./resolve.js";
import { getScheduledMessage } from "./getScheduledMessage.js";
import { toEpochMs } from "./createScheduledMessage.js";

export const editScheduledMessageShape = {
  scheduledMessageId: z.string().describe("The ID of the scheduled message to edit"),
  channel: z.string().optional().describe("Channel name to move scheduled message to"),
  channelId: z.string().optional().describe("Channel ID or DM channel ID to move scheduled message to"),
  userId: z.string().optional().describe("Recipient's user ID to move scheduled message to a DM"),
  email: z.string().optional().describe("Recipient's email to move scheduled message to a DM"),
  text: z.string().min(1).optional().describe("New text for the scheduled message"),
  sendAt: z
    .union([z.string(), z.number()])
    .optional()
    .describe("New time to send message (ISO date string or epoch timestamp in milliseconds)"),
};

export const editScheduledMessageSchema = z
  .object(editScheduledMessageShape)
  .refine((v) => [v.channel, v.channelId, v.userId, v.email].filter(Boolean).length <= 1, {
    message: "Provide at most one of `channel`, `channelId`, `userId`, or `email`",
  });

export type EditScheduledMessageInput = z.infer<typeof editScheduledMessageSchema>;

export async function editScheduledMessage(input: EditScheduledMessageInput) {
  const existing = (await getScheduledMessage({
    scheduledMessageId: input.scheduledMessageId,
  })) as any;
  if (!existing?.id) {
    throw new Error(`Scheduled message not found: ${input.scheduledMessageId}`);
  }

  // Pumble rejects an edit that omits channelId, text or sendAt, so unchanged
  // fields have to be read back and resent alongside the edited ones.
  return pumbleRequest<{ ok?: boolean }>("/editScheduledMessage", {
    method: "POST",
    body: {
      scheduledMessageId: input.scheduledMessageId,
      channelId: (await resolveDestinationChannelId(input)) ?? existing.channelId,
      text: input.text ?? existing.text,
      sendAt: input.sendAt !== undefined ? toEpochMs(input.sendAt) : existing.sendAt,
    },
  });
}
