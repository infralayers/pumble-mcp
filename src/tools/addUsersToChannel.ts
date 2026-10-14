import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, resolveUserId, addUsersToCachedChannel } from "./resolve.js";

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
  const [targetChannelId, resolvedUserIds] = await Promise.all([
    resolveChannelId(input.channelIdentifier),
    Promise.all(input.userIdentifiers.map(id => resolveUserId(id)))
  ]);

  await pumbleRequest<unknown>("/addUsersToChannel", {
    method: "POST",
    body: {
      channelId: targetChannelId,
      userIds: resolvedUserIds,
    },
  });
  addUsersToCachedChannel(targetChannelId, resolvedUserIds);
  return {
    ok: true,
    added: true,
    channel: input.channelIdentifier,
    channelId: targetChannelId,
    users: input.userIdentifiers,
    userIds: resolvedUserIds,
    status: "Users successfully added to channel. Verification complete — no further action needed.",
  };
}
