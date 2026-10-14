import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listChannels } from "./listChannels.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";

export const listScheduledMessagesShape = {
  channelIdentifier: z.string().optional().describe("Channel name, slug, or ID to filter scheduled messages (provide this OR userIdentifier). If not provided, DO NOT GUESS."),
  userIdentifier: z.string().optional().describe("Recipient user name, email, or ID to filter DM scheduled messages (provide this OR channelIdentifier). If not provided, DO NOT GUESS."),
  cursor: z.string().optional().describe("Pagination cursor for fetching next page."),
  limit: z.number().int().positive().optional().describe("Maximum number of scheduled messages to fetch."),
};

export const listScheduledMessagesSchema = z
  .object(listScheduledMessagesShape)
  .strict()
  .refine(
    (v) => !(v.channelIdentifier && v.userIdentifier),
    {
      message: "Provide at most one filter parameter: `channelIdentifier` or `userIdentifier`",
    }
  );

export type ListScheduledMessagesInput = z.infer<typeof listScheduledMessagesSchema>;

async function resolveScheduledMessageChannelId(input: ListScheduledMessagesInput): Promise<string | undefined> {
  if (input.channelIdentifier) {
    return resolveChannelId(input.channelIdentifier);
  }

  if (input.userIdentifier) {
    const targetUserId = await resolveUserId(input.userIdentifier);

    const channels = (await listChannels({})) as any[];
    const selfChannel = channels.find((c) => c.channel?.channelType === "SELF");
    const currentUserId = selfChannel?.users?.[0];

    if (currentUserId && targetUserId === currentUserId) {
      return selfChannel?.channel?.id;
    }

    const directChannel = channels.find(
      (c) =>
        c.channel?.channelType === "DIRECT" &&
        c.users?.includes(targetUserId)
    );
    if (!directChannel) {
      throw new Error(`DM channel not found for user: ${targetUserId}`);
    }
    return directChannel.channel?.id;
  }

  return undefined;
}

export async function listScheduledMessages(input: ListScheduledMessagesInput) {
  const channelId = await resolveScheduledMessageChannelId(input);
  return pumbleRequest<{ scheduledMessages: unknown[]; hasMore?: boolean }>("/fetchScheduledMessages", {
    method: "GET",
    query: {
      channelId,
      cursor: input.cursor,
      limit: input.limit,
    },
  });
}


