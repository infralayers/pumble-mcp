import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";
import { getChannel } from "./getChannel.js";

export const removeUserFromChannelShape = {
  channelIdentifier: z.string().min(1).describe("Channel name, slug, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  userIdentifier: z.string().min(1).describe("User name, email, or ID of the user to remove. If not provided, MUST ASK. DO NOT GUESS."),
  confirm: z.literal(true, {
    errorMap: () => ({ message: "You MUST explicitly set confirm: true to perform this destructive operation" })
  }).describe("Explicit confirmation boolean. Must be true. (Do not guess)"),
  confirmationToken: z.string().optional().describe("One-time security confirmation token authorized by the human user."),
};

export const removeUserFromChannelSchema = z.object(removeUserFromChannelShape).strict();

export type RemoveUserFromChannelInput = z.infer<typeof removeUserFromChannelSchema>;

export async function removeUserFromChannel(input: RemoveUserFromChannelInput) {
  const targetChannelId = await resolveChannelId(input.channelIdentifier);
  const resolvedUserId = await resolveUserId(input.userIdentifier);

  try {
    return await pumbleRequest<unknown>("/removeUserFromChannel", {
      method: "POST",
      body: { channelId: targetChannelId, userId: resolvedUserId },
    });
  } catch (err: any) {
    if (err.message && err.message.includes("403")) {
      const channelData = await getChannel({ channelIdentifier: targetChannelId });
      
      if (!channelData.users || !channelData.users.includes(resolvedUserId)) {
        throw new Error("Failed to remove user: They are not a member of this channel.");
      }
    }
    throw err;
  }
}
