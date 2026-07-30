import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";

export const removeUserFromChannelShape = {
  channelIdentifier: z.string().min(1).describe("The name or ID of the channel. (Do not guess)"),
  userIdentifier: z.string().min(1).describe("The name, email, or ID of the user to remove. (Do not guess)"),
  confirm: z.literal(true, {
    errorMap: () => ({ message: "You MUST explicitly set confirm: true to perform this destructive operation" })
  }).describe("Explicit confirmation boolean. Must be true."),
};

export const removeUserFromChannelSchema = z.object(removeUserFromChannelShape);

export type RemoveUserFromChannelInput = z.infer<typeof removeUserFromChannelSchema>;

export async function removeUserFromChannel(input: RemoveUserFromChannelInput) {
  const targetChannelId = await resolveChannelId(input.channelIdentifier);
  const resolvedUserId = await resolveUserId(input.userIdentifier);

  return pumbleRequest<unknown>("/removeUserFromChannel", {
    method: "POST",
    body: {
      channelId: targetChannelId,
      userId: resolvedUserId,
    },
  });
}
