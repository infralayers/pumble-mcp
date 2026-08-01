import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveDestinationChannelId } from "./resolve.js";

export const listScheduledMessagesShape = {
  channel: z.string().optional().describe("Channel name to filter scheduled messages"),
  channelId: z.string().optional().describe("Channel ID or DM channel ID to filter scheduled messages"),
  userId: z.string().optional().describe("Recipient's user ID to filter DM scheduled messages"),
  email: z.string().optional().describe("Recipient's email to filter DM scheduled messages"),
  cursor: z.string().optional().describe("Optional pagination cursor for fetching next page of scheduled messages"),
  limit: z.number().int().positive().optional().describe("Maximum number of scheduled messages to fetch"),
};

export const listScheduledMessagesSchema = z
  .object(listScheduledMessagesShape)
  .refine((v) => [v.channel, v.channelId, v.userId, v.email].filter(Boolean).length <= 1, {
    message: "Provide at most one of `channel`, `channelId`, `userId`, or `email`",
  });

export type ListScheduledMessagesInput = z.infer<typeof listScheduledMessagesSchema>;

export async function listScheduledMessages(input: ListScheduledMessagesInput) {
  return pumbleRequest<{ scheduledMessages: unknown[]; hasMore?: boolean }>("/fetchScheduledMessages", {
    method: "GET",
    query: {
      channelId: await resolveDestinationChannelId(input),
      cursor: input.cursor,
      limit: input.limit,
    },
  });
}

