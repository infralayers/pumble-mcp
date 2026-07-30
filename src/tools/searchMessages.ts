import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";

export const searchMessagesShape = {
  text: z.string().optional().describe("Text to search for"),
  fromUserIdentifiers: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("User names, emails, or IDs to search from. (Do not guess)"),
  inChannelIdentifiers: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("Channel names or IDs to search in. (Do not guess)"),
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

  return pumbleRequest<unknown[]>("/searchMessages", {
    method: "POST",
    body: {
      text: input.text,
      ...(resolvedFrom && resolvedFrom.length > 0 ? { from: resolvedFrom } : {}),
      ...(resolvedIn && resolvedIn.length > 0 ? { in: resolvedIn } : {})
    },
  });
}
