import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId } from "./resolve.js";

export const addUsersToChannelShape = {
  channelIdentifier: z.string().min(1).describe("Channel name, slug, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  userIdentifiers: z
    .array(z.string().min(1).describe("User name, email, or ID. If not provided, MUST ASK. DO NOT GUESS."))
    .min(1)
    .describe("Array of user names, emails, or IDs to add. If not provided, MUST ASK. DO NOT GUESS."),
};

export const addUsersToChannelSchema = z.object(addUsersToChannelShape).strict();

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
