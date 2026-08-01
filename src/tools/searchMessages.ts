import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";

export const searchMessagesShape = {
  text: z.string().optional().describe("Text to search for"),
  fromUserIdentifiers: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("User names, emails, or IDs to search from. (Do not guess)"),
  inChannelIdentifiers: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("Channel names or IDs to search in. (Do not guess)"),
  after: z.string().optional().describe("Required parameter to fetch recent messages (API defaults to oldest first). Must be a valid ISO 8601 date string. (Do not guess)"),
  before: z.string().optional().describe("Filter messages before this date. Must be a valid ISO 8601 date string. (Do not guess)"),
};

export const searchMessagesSchema = z.object(searchMessagesShape).refine(
  (data) => Boolean(data.text) || (data.fromUserIdentifiers && data.fromUserIdentifiers.length > 0) || (data.inChannelIdentifiers && data.inChannelIdentifiers.length > 0),
  { message: "At least one of 'text', 'fromUserIdentifiers', or 'inChannelIdentifiers' must be provided." }
);

export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;

export async function searchMessages(input: SearchMessagesInput) {
  let resolvedFrom: string[] | undefined = undefined;
  let resolvedIn: string[] | undefined = undefined;

  if (input.fromUserIdentifiers && input.fromUserIdentifiers.length > 0) {
    resolvedFrom = [];
    for (const identifier of input.fromUserIdentifiers) {
      resolvedFrom.push(await resolveUserId(identifier));
    }
  }

  if (input.inChannelIdentifiers && input.inChannelIdentifiers.length > 0) {
    resolvedIn = [];
    for (const identifier of input.inChannelIdentifiers) {
      resolvedIn.push(await resolveChannelId(identifier));
    }
  }

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

  // Client-side sorting: API returns sequential timestamps (oldest first).
  // We reverse the array using descending sort to show newest items first.
  if (result) {
    if (Array.isArray(result.content)) {
      result.content.sort((a: any, b: any) => (b.timestampMilli || 0) - (a.timestampMilli || 0));
    } else if (Array.isArray(result)) {
      result.sort((a: any, b: any) => (b.timestampMilli || 0) - (a.timestampMilli || 0));
    } else if (result.messages && Array.isArray(result.messages)) {
      result.messages.sort((a: any, b: any) => (b.timestampMilli || 0) - (a.timestampMilli || 0));
    }
  }

  return result;
}
