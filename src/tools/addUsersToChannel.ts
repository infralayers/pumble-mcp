import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";

export const addUsersToChannelShape = {
  channelIdentifier: z.string().min(1).describe("The name or ID of the channel. (Do not guess)"),
  userIdentifiers: z.array(z.string().min(1)).min(1).describe("Array of user names, emails, or IDs to add. (Do not guess)"),
};

export const addUsersToChannelSchema = z.object(addUsersToChannelShape);

export type AddUsersToChannelInput = z.infer<typeof addUsersToChannelSchema>;

export async function addUsersToChannel(input: AddUsersToChannelInput) {
  const targetChannelId = await resolveChannelId(input.channelIdentifier);

  const resolvedUserIds: string[] = [];
  for (const identifier of input.userIdentifiers) {
    const resolvedId = await resolveUserId(identifier);
    resolvedUserIds.push(resolvedId);
  }

  return pumbleRequest<unknown>("/addUsersToChannel", {
    method: "POST",
    body: {
      channelId: targetChannelId,
      userIds: resolvedUserIds,
    },
  });
}
