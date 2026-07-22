import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listUsers } from "./listUsers.js";
import { listChannels } from "./listChannels.js";
import {
  describeChannelCandidates,
  describeUserCandidates,
  isLikelyId,
  matchChannelsByName,
  matchUsersByNameOrEmail,
  type PumbleChannelListItem,
  type PumbleUser,
} from "./resolve.js";

export const searchMessagesShape = {
  text: z.string().optional().describe("Text to search for"),
  fromUser: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("User names, emails, or IDs to search from"),
  inChannel: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("Channel names or IDs to search in"),
};

export const searchMessagesSchema = z.object(searchMessagesShape).refine(
  (data) => Boolean(data.text) || (data.fromUser && data.fromUser.length > 0) || (data.inChannel && data.inChannel.length > 0),
  { message: "At least one of 'text', 'fromUser', or 'inChannel' must be provided." }
);

export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;

export async function searchMessages(input: SearchMessagesInput) {
  let resolvedFrom: string[] | undefined = undefined;
  let resolvedIn: string[] | undefined = undefined;

  // Resolve users. Identifiers that don't match exactly one user are passed
  // through as-is (rather than throwing) so Pumble's own API can reject them
  // with a clean error - this is a read-only search, not a destructive
  // operation, so we don't need to hard-fail on an unresolved name. An
  // *ambiguous* match is different: silently guessing which of several
  // same-named users to search by would be a real correctness bug, so that
  // still throws.
  if (input.fromUser && input.fromUser.length > 0) {
    resolvedFrom = [];
    let usersList: PumbleUser[] | null = null;

    for (const identifier of input.fromUser) {
      if (isLikelyId(identifier)) {
        resolvedFrom.push(identifier);
      } else {
        if (!usersList) {
          usersList = (await listUsers({})) as PumbleUser[];
        }

        const matches = matchUsersByNameOrEmail(identifier, usersList);
        if (matches.length > 1) {
          throw new Error(
            `'${identifier}' matches multiple users in the workspace: ${describeUserCandidates(matches)}. Provide the exact user ID instead.`,
          );
        }
        resolvedFrom.push(matches.length === 1 ? matches[0].id : identifier);
      }
    }
  }

  // Resolve channels - same pass-through-on-no-match, throw-on-ambiguous policy as above.
  if (input.inChannel && input.inChannel.length > 0) {
    resolvedIn = [];
    let channelsList: PumbleChannelListItem[] | null = null;

    for (const identifier of input.inChannel) {
      if (isLikelyId(identifier)) {
        resolvedIn.push(identifier);
      } else {
        if (!channelsList) {
          channelsList = (await listChannels({})) as PumbleChannelListItem[];
        }

        const matches = matchChannelsByName(identifier, channelsList);
        if (matches.length > 1) {
          throw new Error(
            `'${identifier}' matches multiple channels in the workspace: ${describeChannelCandidates(matches)}. Provide the exact channel ID instead.`,
          );
        }
        resolvedIn.push(matches.length === 1 ? matches[0].channel!.id : identifier);
      }
    }
  }

  return pumbleRequest<unknown[]>("/searchMessages", {
    method: "POST",
    body: {
      text: input.text,
      ...(resolvedFrom && resolvedFrom.length > 0 ? { from: resolvedFrom } : {}),
      ...(resolvedIn && resolvedIn.length > 0 ? { in: resolvedIn } : {})
    },
  });
}
