import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listChannels } from "./listChannels.js";
import { listUsers } from "./listUsers.js";

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
  let targetChannelId = input.channelId;

  // 1. Resolve Channel
  if (input.channel) {
    const channelsList = (await listChannels({})) as any[];
    const lowerIdentifier = input.channel.toLowerCase();
    
    const matchedChannel = channelsList.find((c: any) => 
      c.channel && c.channel.name && c.channel.name.toLowerCase() === lowerIdentifier
    );

    if (matchedChannel && matchedChannel.channel) {
      targetChannelId = matchedChannel.channel.id;
    } else {
      throw new Error(`Channel with name '${input.channel}' could not be found in the workspace.`);
    }
  }

  // 2. Resolve User
  let resolvedUserId: string = input.user;
  const isLikelyId = /^[0-9a-fA-F]{24}$/.test(input.user);
    
  if (!isLikelyId) {
    const usersList = (await listUsers({})) as any[];
    const lowerIdentifier = input.user.toLowerCase();
      
    const matchedUser = usersList.find((u: any) => 
      (u.name && u.name.toLowerCase() === lowerIdentifier) || 
      (u.email && u.email.toLowerCase() === lowerIdentifier)
    );
      
    if (matchedUser) {
      resolvedUserId = matchedUser.id;
    } else {
      throw new Error(`User '${input.user}' could not be found in the workspace.`);
    }
  }

  // 3. Make API Call
  return pumbleRequest<unknown>("/removeUserFromChannel", {
    method: "POST",
    body: {
      channelId: targetChannelId,
      userId: resolvedUserId,
    },
  });
}
