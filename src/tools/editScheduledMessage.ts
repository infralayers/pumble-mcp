import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listChannels } from "./listChannels.js";
import { listUsers } from "./listUsers.js";
import { getScheduledMessage } from "./getScheduledMessage.js";

export const editScheduledMessageShape = {
  scheduledMessageId: z.string().describe("The ID of the scheduled message to edit"),
  channel: z.string().optional().describe("Channel name to move scheduled message to"),
  channelId: z.string().optional().describe("Channel ID or DM channel ID to move scheduled message to"),
  userId: z.string().optional().describe("Recipient's user ID to move scheduled message to a DM"),
  email: z.string().optional().describe("Recipient's email to move scheduled message to a DM"),
  text: z.string().min(1).optional().describe("New text for the scheduled message"),
  sendAt: z
    .union([z.string(), z.number()])
    .optional()
    .describe("New time to send message (ISO date string or epoch timestamp in milliseconds)"),
};

export const editScheduledMessageSchema = z
  .object(editScheduledMessageShape)
  .refine(
    (v) => {
      const targets = [v.channel, v.channelId, v.userId, v.email].filter(Boolean);
      return targets.length <= 1;
    },
    {
      message: "Provide at most one target filter parameter from: `channel`, `channelId`, `userId`, or `email`",
    }
  );

export type EditScheduledMessageInput = z.infer<typeof editScheduledMessageSchema>;

async function resolveChannelId(input: EditScheduledMessageInput): Promise<string | undefined> {
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

export async function editScheduledMessage(input: EditScheduledMessageInput) {
  // 1. Fetch the existing scheduled message details
  const existing = (await getScheduledMessage({
    scheduledMessageId: input.scheduledMessageId,
  })) as any;
  if (!existing || !existing.id) {
    throw new Error(`Scheduled message not found: ${input.scheduledMessageId}`);
  }

  // 2. Resolve the new channel ID if requested
  const resolvedChannelId = await resolveChannelId(input);

  // 3. Merge new values with existing ones
  const channelId = resolvedChannelId !== undefined ? resolvedChannelId : existing.channelId;
  const text = input.text !== undefined ? input.text : existing.text;

  let sendAt: number;
  if (input.sendAt !== undefined) {
    if (typeof input.sendAt === "number") {
      sendAt = input.sendAt;
    } else {
      const parsed = new Date(input.sendAt).getTime();
      if (isNaN(parsed)) {
        throw new Error(`Invalid date format for sendAt: ${input.sendAt}`);
      }
      sendAt = parsed;
    }
  } else {
    sendAt = existing.sendAt;
  }

  // 4. Construct the final complete body required by Pumble
  const body = {
    scheduledMessageId: input.scheduledMessageId,
    channelId,
    text,
    sendAt,
  };

  return pumbleRequest<{ ok?: boolean }>("/editScheduledMessage", {
    method: "POST",
    body,
  });
}

