import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId, resolveDmChannelId } from "./resolve.js";

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

async function resolveScheduledMessageChannelId(input: CreateScheduledMessageInput): Promise<string> {
  if (input.channelIdentifier) {
    return resolveChannelId(input.channelIdentifier);
  }

  if (input.userIdentifier) {
    const targetUserId = await resolveUserId(input.userIdentifier);
    return resolveDmChannelId(targetUserId);
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

