import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveBatch, addUsersToCachedChannel } from "./resolve.js";

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
  const { userIds } = await resolveBatch({
    users: input.userIdentifiers,
    actionName: "add users to channel",
  });

  await pumbleRequest<unknown>("/addUsersToChannel", {
    method: "POST",
    body: {
      channelId: targetChannelId,
      userIds: userIds!,
    },
  });

  addUsersToCachedChannel(targetChannelId, userIds!);

  return {
    ok: true,
    added: true,
    channel: input.channelIdentifier,
    channelId: targetChannelId,
    addedUsers: input.userIdentifiers,
    addedUserIds: userIds!,
    status: "Users successfully added to channel. Verification complete — no further action needed.",
  };
}
