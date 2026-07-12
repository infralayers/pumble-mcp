import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const listThreadRepliesShape = {
  messageId: z.string().describe("The ID of the parent message/thread"),
  channelId: z.string().describe("The ID of the channel the thread is in"),
  cursor: z.string().optional().describe("Pagination cursor"),
  limit: z.number().int().positive().optional().describe("Max number of replies to fetch"),
};

export const listThreadRepliesSchema = z.object(listThreadRepliesShape);

export type ListThreadRepliesInput = z.infer<typeof listThreadRepliesSchema>;

export type ListThreadRepliesResult = unknown[];

export async function listThreadReplies(input: ListThreadRepliesInput) {
  return pumbleRequest<ListThreadRepliesResult>("/fetchThreadReplies", {
    method: "GET",
    query: {
      rootMessageId: input.messageId,
      channelId: input.channelId,
      cursor: input.cursor,
      limit: input.limit,
    },
  });
}
