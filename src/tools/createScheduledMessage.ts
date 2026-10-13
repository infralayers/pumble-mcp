import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId, resolveDmChannelId } from "./resolve.js";

export const createScheduledMessageShape = {
  channelIdentifier: z.string().optional().describe("Channel name, slug, or ID (provide this OR userIdentifier). If not provided, MUST ASK. DO NOT GUESS."),
  userIdentifier: z.string().optional().describe("Recipient user name, email, or ID for a DM (provide this OR channelIdentifier). If not provided, MUST ASK. DO NOT GUESS."),
  text: z.string().min(1).max(4000).describe("The scheduled message text (max 4000 characters). If not provided, MUST ASK. DO NOT GUESS."),
  sendAt: z.union([z.string(), z.number()]).describe("Time to send message (ISO date string or epoch timestamp in milliseconds at least 30s in future). If not provided, MUST ASK. DO NOT GUESS."),
};

export const createScheduledMessageSchema = z
  .object(createScheduledMessageShape)
  .strict()
  .refine(
    (v) => Boolean(v.channelIdentifier) !== Boolean(v.userIdentifier),
    {
      message: "Provide exactly one target filter: `channelIdentifier` or `userIdentifier`",
    }
  );

export type CreateScheduledMessageInput = z.infer<typeof createScheduledMessageSchema>;

/** Accept either an epoch timestamp or anything `Date` can parse, e.g. an ISO string. */
export function toEpochMs(value: string | number, fieldName = "sendAt"): number {
  const parsed = typeof value === "number" ? value : new Date(value).getTime();
  if (isNaN(parsed)) {
    throw new Error(`Invalid date format for ${fieldName}: ${value}`);
  }
  if (fieldName === "sendAt" && parsed < Date.now() + 30_000) {
    throw new Error("sendAt must be a timestamp at least 30 seconds in the future.");
  }
  return parsed;
}

async function resolveScheduledMessageChannelId(input: CreateScheduledMessageInput): Promise<string> {
  if (input.channelIdentifier) {
    return resolveChannelId(input.channelIdentifier);
  }

  if (input.userIdentifier) {
    const targetUserId = await resolveUserId(input.userIdentifier);
    try {
      return await resolveDmChannelId(targetUserId);
    } catch {
      throw new Error(
        `Cannot schedule DM to user '${input.userIdentifier}': No direct conversation exists with this user yet. Please send a normal direct message first.`
      );
    }
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

