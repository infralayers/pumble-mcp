import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";

export const removeUserFromChannelShape = {
  channel: z.string().optional().describe("Channel name (provide this OR channelId)"),
  channelId: z.string().optional().describe("Channel ID (provide this OR channel)"),
  user: z.string().describe("User name, email, or 24-character ID to remove"),
  confirm: z.literal(true, {
    errorMap: () => ({ message: "You MUST explicitly set confirm: true to perform this destructive operation" })
  }).describe("Explicit confirmation boolean. Must be true."),
};

export const removeUserFromChannelSchema = z
  .object(removeUserFromChannelShape)
  .refine((v) => Boolean(v.channel) !== Boolean(v.channelId), {
    message: "Provide exactly one of `channel` or `channelId`",
  });

export type RemoveUserFromChannelInput = z.infer<typeof removeUserFromChannelSchema>;

export async function removeUserFromChannel(input: RemoveUserFromChannelInput) {
  const targetChannelId = input.channel ? await resolveChannelId(input.channel) : input.channelId!;
  const resolvedUserId = await resolveUserId(input.user);

  return pumbleRequest<unknown>("/removeUserFromChannel", {
    method: "POST",
    body: {
      channelId: targetChannelId,
      userId: resolvedUserId,
    },
  });
}
