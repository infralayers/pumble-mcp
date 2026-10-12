import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const listMessagesShape = {
  channelIdentifier: z.string().min(1).describe("Channel name, slug, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  cursor: z.string().optional().describe("Pagination cursor for next page."),
  limit: z.number().int().positive().optional().describe("Max number of messages to fetch."),
  confirmationToken: z.string().optional().describe("One-time security confirmation token authorized by the human user."),
};

export const listMessagesSchema = z.object(listMessagesShape).strict();

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
