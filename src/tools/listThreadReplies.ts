import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const listThreadRepliesShape = {
  messageId: z.string().min(1).describe("The exact ID of the parent message/thread. If unknown, use pumble_search_messages to find it first."),
  channelIdentifier: z.string().min(1).describe("Channel name or ID the thread is in"),
  cursor: z.string().optional().describe("ID of the reply to resume from, to page through a long thread. That reply is included again, followed by older ones."),
  limit: z.number().int().positive().optional().describe("Max number of replies to fetch, counted after the cursor when one is given"),
};

export const listThreadRepliesSchema = z.object(listThreadRepliesShape);

export type ListThreadRepliesInput = z.infer<typeof listThreadRepliesSchema>;

/** A bare array of replies, newest first — not the envelope `listMessages` returns. */
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
