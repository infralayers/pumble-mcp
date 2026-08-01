import { listChannels } from "./listChannels.js";
import { listUsers } from "./listUsers.js";

const ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export interface PumbleChannelListItem {
  channel?: {
    id: string;
    name?: string;
    channelType?: string;
  };
  users?: string[];
}

export interface PumbleUser {
  id: string;
  name?: string;
  email?: string;
}

export function isLikelyId(identifier: string): boolean {
  return ID_PATTERN.test(identifier);
}

export function matchChannelsByName(identifier: string, channelsList: PumbleChannelListItem[]): PumbleChannelListItem[] {
  const lower = identifier.toLowerCase();
  return channelsList.filter((c) => c.channel?.name?.toLowerCase() === lower);
}

export function matchUsersByNameOrEmail(identifier: string, usersList: PumbleUser[]): PumbleUser[] {
  const lower = identifier.toLowerCase();
  return usersList.filter(
    (u) => u.name?.toLowerCase() === lower || u.email?.toLowerCase() === lower,
  );
}

export function describeChannelCandidates(matches: PumbleChannelListItem[]): string {
  return matches.map((c) => `${c.channel?.name} (id: ${c.channel?.id})`).join(", ");
}

export function describeUserCandidates(matches: PumbleUser[]): string {
  return matches.map((u) => `${u.name} <${u.email || "no email"}> (id: ${u.id})`).join(", ");
}

/**
 * Resolve a channel name or ID to a channel ID. Throws if the name matches
 * zero or more than one channel, rather than silently guessing.
 */
export async function resolveChannelId(identifier: string): Promise<string> {
  if (isLikelyId(identifier)) return identifier;

  const channelsList = (await listChannels({})) as PumbleChannelListItem[];
  const matches = matchChannelsByName(identifier, channelsList);

  if (matches.length === 0) {
    throw new Error(`Channel with name '${identifier}' could not be found in the workspace.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `'${identifier}' matches multiple channels in the workspace: ${describeChannelCandidates(matches)}. Provide the exact channel ID instead.`,
    );
  }
  return matches[0].channel!.id;
}

/**
 * Resolve a user ID to the ID of the DM channel with that user. Pumble only
 * creates a DM channel once a message has been sent, so there is nothing to
 * target for someone the workspace has never messaged.
 */
async function resolveDmChannelId(userId: string): Promise<string> {
  const channelsList = (await listChannels({})) as PumbleChannelListItem[];

  const selfChannel = channelsList.find((c) => c.channel?.channelType === "SELF");
  if (selfChannel?.channel?.id && selfChannel.users?.[0] === userId) {
    return selfChannel.channel.id;
  }

  const directChannel = channelsList.find(
    (c) => c.channel?.channelType === "DIRECT" && c.users?.includes(userId),
  );
  if (!directChannel?.channel?.id) {
    throw new Error(
      `No existing DM channel with user '${userId}'. Send them a direct message first, then schedule.`,
    );
  }
  return directChannel.channel.id;
}

/**
 * Resolve a user name, email, or ID to a user ID. Throws if the identifier
 * matches zero or more than one user, rather than silently guessing.
 */
export async function resolveUserId(identifier: string): Promise<string> {
  if (isLikelyId(identifier)) return identifier;

  const usersList = (await listUsers({})) as PumbleUser[];
  const matches = matchUsersByNameOrEmail(identifier, usersList);

  if (matches.length === 0) {
    throw new Error(`User '${identifier}' could not be found in the workspace.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `'${identifier}' matches multiple users in the workspace: ${describeUserCandidates(matches)}. Provide the exact user ID instead.`,
    );
  }
  return matches[0].id;
}

export interface ChannelDestination {
  channel?: string;
  channelId?: string;
  userId?: string;
  email?: string;
}

/**
 * Resolve whichever destination field the caller supplied down to a channel ID.
 * The scheduled-message endpoints only accept `channelId`, so every other way
 * of naming a destination has to be looked up first. Returns undefined when no
 * destination was given at all.
 */
export async function resolveDestinationChannelId(
  destination: ChannelDestination,
): Promise<string | undefined> {
  if (destination.channelId) return destination.channelId;
  if (destination.channel) return resolveChannelId(destination.channel);

  const userId = destination.email ? await resolveUserId(destination.email) : destination.userId;
  return userId ? resolveDmChannelId(userId) : undefined;
}
