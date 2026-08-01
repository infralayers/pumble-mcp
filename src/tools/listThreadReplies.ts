import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const listThreadRepliesShape = {
  messageId: z.string().min(1).describe("The exact ID of the parent message/thread. If unknown, use pumble_search_messages to find it first. (Do not guess)"),
  channelIdentifier: z.string().min(1).describe("The name or ID of the channel the thread is in. (Do not guess)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  limit: z.number().int().positive().optional().describe("Max number of replies to fetch"),
};

export const listThreadRepliesSchema = z.object(listThreadRepliesShape);

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
