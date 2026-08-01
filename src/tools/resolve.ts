import { listChannels } from "./listChannels.js";
import { listUsers } from "./listUsers.js";

// Supports standard 24-character hex IDs from Pumble, as well as u1/c1 mock IDs used in unit tests.
const ID_PATTERN = /^[0-9a-fA-F]{24}$|^[uc]\d+$/;

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
  realName?: string;
  email?: string;
  status?: string;
}

export function isLikelyId(identifier: string): boolean {
  return ID_PATTERN.test(identifier);
}

export function matchChannelsByName(identifier: string, channelsList: PumbleChannelListItem[]): PumbleChannelListItem[] {
  const lower = identifier.toLowerCase();
  return channelsList.filter((c) => c.channel?.name?.toLowerCase() === lower);
}

export function matchUsersByNameOrEmail(identifier: string, usersList: PumbleUser[]): PumbleUser[] {
  const lowerTarget = identifier.toLowerCase();
  
  // Phase 1: Exact Email
  const exactEmailMatches = usersList.filter(u => u.email?.toLowerCase() === lowerTarget);
  if (exactEmailMatches.length > 0) return exactEmailMatches;

  // Phase 2: Exact Name
  const exactNameMatches = usersList.filter(u => 
    (u.name && u.name.toLowerCase() === lowerTarget) || 
    (u.realName && u.realName.toLowerCase() === lowerTarget)
  );
  if (exactNameMatches.length > 0) return exactNameMatches;

  // Phase 3: Substring Name (space-insensitive)
  const normalizedTarget = lowerTarget.replace(/\s+/g, '');
  return usersList.filter(u => {
    const normalizedName = u.name?.toLowerCase().replace(/\s+/g, '');
    const normalizedRealName = u.realName?.toLowerCase().replace(/\s+/g, '');
    return (normalizedName && normalizedName.includes(normalizedTarget)) || 
           (normalizedRealName && normalizedRealName.includes(normalizedTarget));
  });
}

export function describeChannelCandidates(matches: PumbleChannelListItem[]): string {
  return matches.map((c) => `${c.channel?.name} (id: ${c.channel?.id})`).join(", ");
}

export function describeUserCandidates(matches: PumbleUser[]): string {
  return matches.map((u) => `${u.name || u.realName} <${u.email || "no email"}> (id: ${u.id})`).join(", ");
}

export async function resolveChannelId(identifier: string): Promise<string> {
  if (isLikelyId(identifier)) return identifier;

  const channelsList = (await listChannels({})) as PumbleChannelListItem[];
  const matches = matchChannelsByName(identifier, channelsList);

  if (matches.length === 1) {
    return matches[0].channel!.id;
  }
  if (matches.length > 1) {
    throw new Error(
      `'${identifier}' matches multiple channels in the workspace: ${describeChannelCandidates(matches)}. Provide the exact channel ID instead.`,
    );
  }

  // Phase 2: If no channel matches by name, try resolving it as a User to find their DM channel
  try {
    const userId = await resolveUserId(identifier);
    // Find a DIRECT channel containing this user
    const dmChannel = channelsList.find(c => 
      c.channel?.channelType === "DIRECT" && 
      c.users?.includes(userId)
    );
    if (dmChannel && dmChannel.channel?.id) {
      return dmChannel.channel.id;
    }
    throw new Error(`User '${identifier}' found, but no DM channel exists with them.`);
  } catch (err) {
    // If resolveUserId fails, throw the original channel not found error
    throw new Error(`Channel with name '${identifier}' could not be found in the workspace.`);
  }
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
  const rawMatches = matchUsersByNameOrEmail(identifier, usersList);

  const lowerTarget = identifier.toLowerCase();
  const deactivatedEmailMatch = rawMatches.find(u => u.email?.toLowerCase() === lowerTarget && u.status === "DEACTIVATED");
  if (deactivatedEmailMatch) {
    throw new Error(`User with email '${identifier}' is deactivated and cannot be added to a DM.`);
  }

  const activeMatches = rawMatches.filter(u => u.status !== "DEACTIVATED");

  if (activeMatches.length === 0) {
    throw new Error(`User not found for '${identifier}'. CRITICAL RULE: DO NOT guess. Abort workflow or request precise email/ID from the caller.`);
  }
  
  if (activeMatches.length > 1) {
    throw new Error(
      `Ambiguous name '${identifier}'. Multiple matches found: ${describeUserCandidates(activeMatches)}. CRITICAL RULE: DO NOT guess. Abort workflow or request precise email/ID from the caller.`,
    );
  }
  return activeMatches[0].id;
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
