import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const listMessagesShape = {
  channel: z.string().optional().describe("Channel name (provide this OR channelId)"),
  channelId: z.string().optional().describe("Channel ID (provide this OR channel)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  limit: z.number().int().positive().optional().describe("Max number of messages to fetch"),
};

export const listMessagesSchema = z
  .object(listMessagesShape)
  .refine((v) => Boolean(v.channel) !== Boolean(v.channelId), {
    message: "Provide exactly one of `channel` or `channelId`",
  });

export type ListMessagesInput = z.infer<typeof listMessagesSchema>;

export type ListMessagesResult = {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  messages: unknown[];
};

export async function listMessages(input: ListMessagesInput) {
  return pumbleRequest<ListMessagesResult>("/listMessages", {
    method: "GET",
    query: {
      channel: input.channel,
      channelId: input.channelId,
      cursor: input.cursor,
      limit: input.limit,
    },
  });
}
