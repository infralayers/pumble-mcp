import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveDestinationChannelId } from "./resolve.js";

export const createScheduledMessageShape = {
  channel: z.string().optional().describe("Channel name (provide this OR channelId, userId, or email)"),
  channelId: z.string().optional().describe("Channel ID (provide this OR channel, userId, or email)"),
  userId: z.string().optional().describe("Recipient's user ID for a Direct Message (provide this OR channel, channelId, or email)"),
  email: z.string().optional().describe("Recipient's email for a Direct Message (provide this OR channel, channelId, or userId)"),
  text: z.string().min(1).describe("The scheduled message text"),
  sendAt: z
    .union([z.string(), z.number()])
    .describe("Time to send message (ISO date string or epoch timestamp in milliseconds)"),
};

export const createScheduledMessageSchema = z
  .object(createScheduledMessageShape)
  .refine((v) => [v.channel, v.channelId, v.userId, v.email].filter(Boolean).length === 1, {
    message: "Provide exactly one of `channel`, `channelId`, `userId`, or `email`",
  });

export type CreateScheduledMessageInput = z.infer<typeof createScheduledMessageSchema>;

/** Accept either an epoch timestamp or anything `Date` can parse, e.g. an ISO string. */
export function toEpochMs(sendAt: string | number): number {
  if (typeof sendAt === "number") return sendAt;

  const parsed = new Date(sendAt).getTime();
  if (isNaN(parsed)) {
    throw new Error(`Invalid date format for sendAt: ${sendAt}`);
  }
  return parsed;
}

export async function createScheduledMessage(input: CreateScheduledMessageInput) {
  const channelId = await resolveDestinationChannelId(input);

  return pumbleRequest<{ id: string; channelId: string }>("/createScheduledMessage", {
    method: "POST",
    body: { text: input.text, sendAt: toEpochMs(input.sendAt), channelId },
  });
}
