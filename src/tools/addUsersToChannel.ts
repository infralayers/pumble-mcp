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
      const matchedUsers = usersList.filter((u: any) =>
        (u.name && u.name.toLowerCase() === lowerIdentifier) ||
        (u.email && u.email.toLowerCase() === lowerIdentifier)
      );

      if (matchedUsers.length === 0) {
        throw new Error(`User '${identifier}' could not be found in the workspace.`);
      }
      if (matchedUsers.length > 1) {
        const candidates = matchedUsers
          .map((u: any) => `${u.name} <${u.email || "no email"}> (id: ${u.id})`)
          .join(", ");
        throw new Error(
          `'${identifier}' matches multiple users in the workspace: ${candidates}. Provide the exact user ID instead.`
        );
      }

      resolvedUserIds.push(matchedUsers[0].id);
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
