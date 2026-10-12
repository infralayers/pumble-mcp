import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";

export const searchMessagesShape = {
  text: z.string().optional().describe("Text query to search for. If not provided, DO NOT GUESS."),
  fromUserIdentifiers: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("User names, emails, or IDs to filter by. If not provided, DO NOT GUESS."),
  inChannelIdentifiers: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("Channel names, slugs, or IDs to filter by. If not provided, DO NOT GUESS."),
  after: z.string().optional().describe("Filter messages after this date (ISO 8601 date string)."),
  before: z.string().optional().describe("Filter messages before this date (ISO 8601 date string)."),
};

export const searchMessagesSchema = z
  .object(searchMessagesShape)
  .strict()
  .refine(
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
