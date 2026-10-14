import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const listThreadRepliesShape = {
  messageId: z.string().min(1).describe("The exact ID of the parent message/thread. If unknown, use pumble_search_messages to find it first. (Do not guess)"),
  channelIdentifier: z.string().min(1).describe("Channel name, slug, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  cursor: z.string().optional().describe("Pagination cursor for next page."),
  limit: z.number().int().positive().optional().describe("Max number of replies to fetch."),
};

export const listThreadRepliesSchema = z.object(listThreadRepliesShape).strict();

export type ListThreadRepliesInput = z.infer<typeof listThreadRepliesSchema>;

export type ListThreadRepliesResult = unknown[];

export async function listThreadReplies(input: ListThreadRepliesInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  return pumbleRequest<ListThreadRepliesResult>("/fetchThreadReplies", {
    method: "GET",
    query: {
      rootMessageId: input.messageId,
      channelId,
      cursor: input.cursor,
      limit: input.limit,
    },
  });
}
