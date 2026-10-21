import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveBatch } from "./resolve.js";

export const searchMessagesShape = {
  text: z.string().min(1).describe("Text query to search for. If not provided, MUST ASK. DO NOT GUESS."),
  fromUserIdentifiers: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("User names, emails, or IDs to filter by. If not provided, DO NOT GUESS."),
  inChannelIdentifiers: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("Channel names, slugs, or IDs to filter by. If not provided, DO NOT GUESS."),
  after: z.string().optional().describe("Filter messages after this date (ISO 8601 date string)."),
  before: z.string().optional().describe("Filter messages before this date (ISO 8601 date string)."),
};

export const searchMessagesSchema = z.object(searchMessagesShape).strict();

export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;

export async function searchMessages(input: SearchMessagesInput) {
  const { userIds: resolvedFrom, channelIds: resolvedIn } = await resolveBatch({
    users: input.fromUserIdentifiers,
    channels: input.inChannelIdentifiers,
    actionName: "search messages",
  });

  const result = await pumbleRequest<any>("/searchMessages", {
    method: "POST",
    body: {
      text: input.text,
      ...(input.after ? { after: input.after } : {}),
      ...(input.before ? { before: input.before } : {}),
      ...(resolvedFrom && resolvedFrom.length > 0 ? { from: resolvedFrom } : {}),
      ...(resolvedIn && resolvedIn.length > 0 ? { in: resolvedIn } : {})
    },
  });

  const sanitizeItem = (m: any) => {
    const item: any = { text: m.text };
    if (m.id || m.messageId) {
      item.id = m.id || m.messageId;
      item.messageId = m.id || m.messageId;
    }
    if (m.channelId) item.channelId = m.channelId;
    if (m.timestamp || m.timestampMilli) item.timestamp = m.timestamp || m.timestampMilli;
    if (m.authorName || m.authorId || m.workspaceUserId) {
      item.author = m.authorName || m.authorId || m.workspaceUserId;
    }
    return item;
  };

  // Client-side sorting and payload sanitization: newest first, capped to top 10
  if (result) {
    if (Array.isArray(result.content)) {
      result.content.sort((a: any, b: any) => (b.timestampMilli || 0) - (a.timestampMilli || 0));
      result.content = result.content.slice(0, 10).map(sanitizeItem);
    } else if (Array.isArray(result)) {
      result.sort((a: any, b: any) => (b.timestampMilli || 0) - (a.timestampMilli || 0));
      return result.slice(0, 10).map(sanitizeItem);
    } else if (result.messages && Array.isArray(result.messages)) {
      result.messages.sort((a: any, b: any) => (b.timestampMilli || 0) - (a.timestampMilli || 0));
      result.messages = result.messages.slice(0, 10).map(sanitizeItem);
    }
  }

  return result;
}
