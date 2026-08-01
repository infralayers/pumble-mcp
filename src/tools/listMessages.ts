import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const listMessagesShape = {
  channelIdentifier: z.string().min(1).describe("The name or ID of the channel. (Do not guess)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  limit: z.number().int().positive().optional().describe("Max number of messages to fetch"),
};

export const listMessagesSchema = z.object(listMessagesShape);

export type ListMessagesInput = z.infer<typeof listMessagesSchema>;

export type ListMessagesResult = {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  messages: unknown[];
};

export async function listMessages(input: ListMessagesInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  return pumbleRequest<ListMessagesResult>("/listMessages", {
    method: "GET",
    query: {
      channelId: channelId,
      cursor: input.cursor,
      limit: input.limit,
    },
  });
}
