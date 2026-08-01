import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listChannels } from "./listChannels.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";
import { getScheduledMessage } from "./getScheduledMessage.js";

export const editScheduledMessageShape = {
  scheduledMessageId: z.string().describe("The ID of the scheduled message to edit"),
  channelIdentifier: z.string().optional().describe("Channel name or ID to move scheduled message to (provide this OR userIdentifier). (Do not guess)"),
  userIdentifier: z.string().optional().describe("Recipient's user name, email, or ID to move scheduled message to a DM (provide this OR channelIdentifier). (Do not guess)"),
  text: z.string().min(1).optional().describe("New text for the scheduled message"),
  sendAt: z.union([z.string(), z.number()]).optional().describe("New time to send message (ISO date string or epoch timestamp in milliseconds)"),
};

export const editScheduledMessageSchema = z
  .object(editScheduledMessageShape)
  .refine(
    (v) => !(v.channelIdentifier && v.userIdentifier),
    {
      message: "Provide at most one target filter parameter: `channelIdentifier` or `userIdentifier`",
    }
  );

export type EditScheduledMessageInput = z.infer<typeof editScheduledMessageSchema>;

async function resolveScheduledMessageChannelId(input: EditScheduledMessageInput): Promise<string | undefined> {
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

export async function editScheduledMessage(input: EditScheduledMessageInput) {
  // 1. Fetch the existing scheduled message details
  const existing = (await getScheduledMessage({
    scheduledMessageId: input.scheduledMessageId,
  })) as any;
  if (!existing || !existing.id) {
    throw new Error(`Scheduled message not found: ${input.scheduledMessageId}`);
  }

  // 2. Resolve the new channel ID if requested
  const resolvedChannelId = await resolveScheduledMessageChannelId(input);

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

