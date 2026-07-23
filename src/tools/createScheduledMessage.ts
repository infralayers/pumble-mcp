import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listChannels } from "./listChannels.js";
import { listUsers } from "./listUsers.js";

export const createScheduledMessageShape = {
  channel: z.string().optional().describe("Channel name (provide this OR channelId, userId, or email)"),
  channelId: z.string().optional().describe("Channel ID (provide this OR channel, userId, or email)"),
  userId: z.string().optional().describe("Recipient's user ID for a Direct Message (provide this OR channel, channelId, or email)"),
  email: z.string().optional().describe("Recipient's email for a Direct Message (provide this OR channel, channelId, or userId)"),
  text: z.string().min(1).describe("The scheduled message text"),
  sendAt: z
    .union([z.string(), z.number()])
    .describe("Time to send message (ISO date string or epoch timestamp in milliseconds)"),
};

export const createScheduledMessageSchema = z
  .object(createScheduledMessageShape)
  .refine(
    (v) => {
      const targets = [v.channel, v.channelId, v.userId, v.email].filter(Boolean);
      return targets.length === 1;
    },
    {
      message: "Provide exactly one target filter: `channel`, `channelId`, `userId`, or `email`",
    }
  );

export type CreateScheduledMessageInput = z.infer<typeof createScheduledMessageSchema>;

async function resolveChannelId(input: CreateScheduledMessageInput): Promise<string> {
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
      if (selfChannel?.channel?.id) return selfChannel.channel.id;
    }

    const directChannel = channels.find(
      (c) =>
        c.channel?.channelType === "DIRECT" &&
        c.users?.includes(targetUserId!)
    );
    if (directChannel?.channel?.id) {
      return directChannel.channel.id;
    }
    throw new Error(`DM channel not found for user: ${targetUserId}`);
  }

  throw new Error("No target destination provided");
}

export async function createScheduledMessage(input: CreateScheduledMessageInput) {
  let sendAtMs: number;
  if (typeof input.sendAt === "number") {
    sendAtMs = input.sendAt;
  } else {
    const parsed = new Date(input.sendAt).getTime();
    if (isNaN(parsed)) {
      throw new Error(`Invalid date format for sendAt: ${input.sendAt}`);
    }
    sendAtMs = parsed;
  }

  const channelId = await resolveChannelId(input);

  const body = {
    text: input.text,
    sendAt: sendAtMs,
    channelId,
  };

  return pumbleRequest<{ id: string; channelId: string }>("/createScheduledMessage", {
    method: "POST",
    body,
  });
}

