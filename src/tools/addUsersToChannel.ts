import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listChannels } from "./listChannels.js";
import { listUsers } from "./listUsers.js";

export const addUsersToChannelShape = {
  channel: z.string().optional().describe("Channel name (provide this OR channelId)"),
  channelId: z.string().optional().describe("Channel ID (provide this OR channel)"),
  users: z.array(z.string()).min(1).describe("Array of user names, emails, or 24-character IDs to add"),
};

export const addUsersToChannelSchema = z
  .object(addUsersToChannelShape)
  .refine((v) => Boolean(v.channel) !== Boolean(v.channelId), {
    message: "Provide exactly one of `channel` or `channelId`",
  });

export type AddUsersToChannelInput = z.infer<typeof addUsersToChannelSchema>;

export async function addUsersToChannel(input: AddUsersToChannelInput) {
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

  // 2. Resolve Users
  const resolvedUserIds: string[] = [];
  let usersList: any[] | null = null;

  for (const identifier of input.users) {
    const isLikelyId = /^[0-9a-fA-F]{24}$/.test(identifier);
    
    if (isLikelyId) {
      resolvedUserIds.push(identifier);
    } else {
      if (!usersList) {
        usersList = (await listUsers({})) as any[];
      }
      
      const lowerIdentifier = identifier.toLowerCase();
      const matchedUser = usersList.find((u: any) => 
        (u.name && u.name.toLowerCase() === lowerIdentifier) || 
        (u.email && u.email.toLowerCase() === lowerIdentifier)
      );
      
      if (matchedUser) {
        resolvedUserIds.push(matchedUser.id);
      } else {
        throw new Error(`User '${identifier}' could not be found in the workspace.`);
      }
    }
  }

  // 3. Make API Call
  return pumbleRequest<unknown>("/addUsersToChannel", {
    method: "POST",
    body: {
      channelId: targetChannelId,
      userIds: resolvedUserIds,
    },
  });
}
