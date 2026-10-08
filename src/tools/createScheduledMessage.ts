import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listChannels } from "./listChannels.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";

export const createScheduledMessageShape = {
  channelIdentifier: z.string().optional().describe("Channel name or ID (provide this OR userIdentifier). (Do not guess)"),
  userIdentifier: z.string().optional().describe("Recipient's user name, email, or ID for a DM (provide this OR channelIdentifier). (Do not guess)"),
  text: z.string().min(1).describe("The scheduled message text. (Do not guess)"),
  sendAt: z.union([z.string(), z.number()]).describe("Time to send message (ISO date string or epoch timestamp in milliseconds). (Do not guess)"),
};

export const createScheduledMessageSchema = z
  .object(createScheduledMessageShape)
  .refine(
    (v) => Boolean(v.channelIdentifier) !== Boolean(v.userIdentifier),
    {
      message: "Provide exactly one target filter: `channelIdentifier` or `userIdentifier`",
    }
  );

export type CreateScheduledMessageInput = z.infer<typeof createScheduledMessageSchema>;

/** Accept either an epoch timestamp or anything `Date` can parse, e.g. an ISO string. */
export function toEpochMs(value: string | number, fieldName = "sendAt"): number {
  if (typeof value === "number") return value;

  const parsed = new Date(value).getTime();
  if (isNaN(parsed)) {
    throw new Error(`Invalid date format for ${fieldName}: ${value}`);
  }
  return parsed;
}

async function resolveScheduledMessageChannelId(input: CreateScheduledMessageInput): Promise<string> {
  if (input.channelIdentifier) {
    return resolveChannelId(input.channelIdentifier);
  }

  if (input.userIdentifier) {
    const targetUserId = await resolveUserId(input.userIdentifier);

    const channels = (await listChannels({})) as any[];
    const selfChannel = channels.find((c) => c.channel?.channelType === "SELF");
    const currentUserId = selfChannel?.users?.[0];

    if (currentUserId && targetUserId === currentUserId) {
      if (selfChannel?.channel?.id) return selfChannel.channel.id;
    }

    const directChannel = channels.find(
      (c) =>
        c.channel?.channelType === "DIRECT" &&
        c.users?.includes(targetUserId)
    );
    if (directChannel?.channel?.id) {
      return directChannel.channel.id;
    }
    throw new Error(`DM channel not found for user: ${targetUserId}`);
  }

  throw new Error("No target destination provided");
}

export async function createScheduledMessage(input: CreateScheduledMessageInput) {
  const sendAtMs = toEpochMs(input.sendAt, "sendAt");

  const channelId = await resolveScheduledMessageChannelId(input);

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

