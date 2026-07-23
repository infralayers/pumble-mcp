import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listChannels } from "./listChannels.js";
import { listUsers } from "./listUsers.js";

export const listScheduledMessagesShape = {
  channel: z.string().optional().describe("Channel name to filter scheduled messages"),
  channelId: z.string().optional().describe("Channel ID or DM channel ID to filter scheduled messages"),
  userId: z.string().optional().describe("Recipient's user ID to filter DM scheduled messages"),
  email: z.string().optional().describe("Recipient's email to filter DM scheduled messages"),
  cursor: z.string().optional().describe("Optional pagination cursor for fetching next page of scheduled messages"),
  limit: z.number().int().positive().optional().describe("Maximum number of scheduled messages to fetch"),
};

export const listScheduledMessagesSchema = z
  .object(listScheduledMessagesShape)
  .refine(
    (v) => {
      const targets = [v.channel, v.channelId, v.userId, v.email].filter(Boolean);
      return targets.length <= 1;
    },
    {
      message: "Provide at most one filter parameter from: `channel`, `channelId`, `userId`, or `email`",
    }
  );

export type ListScheduledMessagesInput = z.infer<typeof listScheduledMessagesSchema>;

async function resolveChannelId(input: ListScheduledMessagesInput): Promise<string | undefined> {
  if (input.channelId) {
    return input.channelId;
  }

  if (input.channel) {
    const res = await pumbleRequest<{ channel?: { id: string } }>("/getChannel", {
      method: "GET",
      query: { channel: input.channel },
    }).catch(() => null);

    if (res?.channel?.id) {
      return res.channel.id;
    }

    const channels = (await listChannels({})) as any[];
    const candidates = channels.map((c) => c.channel?.name).filter(Boolean) as string[];
    const matches = candidates.filter((name) =>
      name.toLowerCase().includes(input.channel!.toLowerCase()) ||
      input.channel!.toLowerCase().includes(name.toLowerCase())
    );

    if (matches.length > 0) {
      throw new Error(`Channel not found: "${input.channel}". Did you mean: ${matches.join(", ")}?`);
    }
    throw new Error(`Channel not found: "${input.channel}"`);
  }

  let targetUserId = input.userId;
  if (input.email) {
    const users = (await listUsers({})) as any[];
    const found = users.find(
      (u) => u.email?.toLowerCase() === input.email!.toLowerCase()
    );
    if (!found) {
      const candidates = users.map((u) => u.email).filter(Boolean) as string[];
      const matches = candidates.filter((email) =>
        email.toLowerCase().includes(input.email!.toLowerCase())
      );
      if (matches.length > 0) {
        throw new Error(`User not found with email: "${input.email}". Did you mean: ${matches.join(", ")}?`);
      }
      throw new Error(`User not found with email: "${input.email}"`);
    }
    targetUserId = found.id;
  }

  if (targetUserId) {
    const channels = (await listChannels({})) as any[];
    const selfChannel = channels.find((c) => c.channel?.channelType === "SELF");
    const currentUserId = selfChannel?.users?.[0];

    if (currentUserId && targetUserId === currentUserId) {
      return selfChannel?.channel?.id;
    }

    const directChannel = channels.find(
      (c) =>
        c.channel?.channelType === "DIRECT" &&
        c.users?.includes(targetUserId!)
    );
    if (!directChannel) {
      throw new Error(`DM channel not found for user: ${targetUserId}`);
    }
    return directChannel.channel?.id;
  }

  return undefined;
}

export async function listScheduledMessages(input: ListScheduledMessagesInput) {
  const channelId = await resolveChannelId(input);
  return pumbleRequest<{ scheduledMessages: unknown[]; hasMore?: boolean }>("/fetchScheduledMessages", {
    method: "GET",
    query: {
      channelId,
      cursor: input.cursor,
      limit: input.limit,
    },
  });
}


