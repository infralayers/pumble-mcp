import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listUsers } from "./listUsers.js";
import {
  describeUserCandidates,
  isLikelyId,
  matchUsersByNameOrEmail,
  resolveChannelId,
  type PumbleUser,
} from "./resolve.js";

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
  const targetChannelId = input.channel ? await resolveChannelId(input.channel) : input.channelId!;

  const resolvedUserIds: string[] = [];
  let usersList: PumbleUser[] | null = null;

  for (const identifier of input.users) {
    if (isLikelyId(identifier)) {
      resolvedUserIds.push(identifier);
      continue;
    }

    if (!usersList) {
      usersList = (await listUsers({})) as PumbleUser[];
    }

    const matches = matchUsersByNameOrEmail(identifier, usersList);
    if (matches.length === 0) {
      throw new Error(`User '${identifier}' could not be found in the workspace.`);
    }
    if (matches.length > 1) {
      throw new Error(
        `'${identifier}' matches multiple users in the workspace: ${describeUserCandidates(matches)}. Provide the exact user ID instead.`,
      );
    }
    resolvedUserIds.push(matches[0].id);
  }

  return pumbleRequest<unknown>("/addUsersToChannel", {
    method: "POST",
    body: {
      channelId: targetChannelId,
      userIds: resolvedUserIds,
    },
  });
}
