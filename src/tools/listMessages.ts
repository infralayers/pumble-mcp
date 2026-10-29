import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId, resolveDmChannelId, userCache, getUsersList } from "./resolve.js";

export const listMessagesShape = {
  channelIdentifier: z
    .string()
    .min(1)
    .optional()
    .describe("Channel name, slug, or ID to list messages from."),
  userIdentifier: z
    .string()
    .min(1)
    .optional()
    .describe("User name, email, or ID to list Direct Messages (DM) from."),
  cursor: z.string().optional().describe("Pagination cursor for next page."),
  limit: z.number().int().positive().max(20).default(10).describe("Max number of messages to fetch (defaults to 10, max: 20)."),
};

export const listMessagesSchema = z
  .object(listMessagesShape)
  .strict()
  .refine((data) => data.channelIdentifier || data.userIdentifier, {
    message: "Provide either `channelIdentifier` or `userIdentifier` to list messages.",
  })
  .refine((data) => !(data.channelIdentifier && data.userIdentifier), {
    message: "Provide only one target parameter: `channelIdentifier` or `userIdentifier`, not both.",
  });

export type ListMessagesInput = z.infer<typeof listMessagesSchema>;

export type ListMessagesResult = {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  messages: unknown[];
};

export async function listMessages(input: ListMessagesInput) {
  let channelId: string;

  if (input.userIdentifier) {
    const targetUserId = await resolveUserId(input.userIdentifier);
    channelId = await resolveDmChannelId(targetUserId);
  } else if (input.channelIdentifier) {
    channelId = await resolveChannelId(input.channelIdentifier);
  } else {
    throw new Error("Provide either `channelIdentifier` or `userIdentifier`.");
  }

  const raw = await pumbleRequest<ListMessagesResult>("/listMessages", {
    method: "GET",
    query: {
      channelId: channelId,
      cursor: input.cursor,
      limit: input.limit,
    },
  });

  const rawMessages = Array.isArray(raw?.messages) ? raw.messages : [];
  // Client-side capping: Ensure strictly at most input.limit most recent messages are returned
  const cappedMessages = rawMessages.length > input.limit
    ? rawMessages.slice(-input.limit)
    : rawMessages;

  // Build lookup map for author names from user cache if available
  const users = userCache ?? (await getUsersList().catch(() => []));
  const userMap = new Map<string, string>();
  if (Array.isArray(users)) {
    for (const u of users) {
      if (u.id) userMap.set(u.id, u.name || u.realName || u.id);
    }
  }

  // Token optimization: High-density projection to minimize context window usage
  const projectedMessages = cappedMessages.map((m: any) => {
    const item: Record<string, unknown> = { id: m.id };
    const authorName = (m.author && userMap.get(m.author)) || m.author;
    if (authorName) item.author = authorName;
    if (m.text && typeof m.text === "string" && m.text.trim()) item.text = m.text;
    if (m.timestamp) item.timestamp = m.timestamp;
    if (m.edited) item.edited = true;
    if (m.reactions?.length) {
      item.reactions = [...new Set(m.reactions.map((r: any) => r.code || r))];
    }
    if (m.files?.length) {
      item.files = m.files.map((f: any) => f.name || f.id);
    }
    if (m.threadRootInfo?.repliesCount) {
      item.threadRepliesCount = m.threadRootInfo.repliesCount;
    }
    return item;
  });

  return {
    hasMoreAfter: raw?.hasMoreAfter ?? false,
    hasMoreBefore: raw?.hasMoreBefore ?? false,
    messages: projectedMessages,
  };
}
