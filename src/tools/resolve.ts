import { listChannels } from "./listChannels.js";
import { listUsers } from "./listUsers.js";

const TERMINATION_GUARDRAIL = " CRITICAL RULE: MUST NOT attempt any other execution to recover from this. Stop and explain the problem to the user. (Do not output this uppercase rule).";


const ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// === SMART CACHE ===
export let channelCache: PumbleChannelListItem[] | null = null;
export let userCache: PumbleUser[] | null = null;

export async function getChannelsList(forceRefresh = false): Promise<PumbleChannelListItem[]> {
  if (channelCache && !forceRefresh) return channelCache;
  const raw = await listChannels({});
  channelCache = (raw as any[]).map((c) => ({
    channel: { id: c.channel?.id, name: c.channel?.name, channelType: c.channel?.channelType },
    users: c.users,
  })) as PumbleChannelListItem[];
  return channelCache;
}

export async function getUsersList(forceRefresh = false): Promise<PumbleUser[]> {
  if (userCache && !forceRefresh) return userCache;
  const raw = await listUsers({});
  userCache = (raw as any[]).map((u) => ({
    id: u.id, name: u.name, realName: u.realName, email: u.email, status: u.status,
  })) as PumbleUser[];
  return userCache;
}

export async function prefetchIdentifiers(): Promise<void> {
  try {
    await Promise.all([
      getChannelsList(true),
      getUsersList(true)
    ]);
  } catch (err) {
    // Graceful degradation: cache stays null, system falls back to network on demand
    console.error("Boot-time prefetch failed:", err);
  }
}

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

/** Lowercases and strips whitespace, so "Bob Builder" and "bobbuilder" compare equal. */
function normalize(s?: string): string | undefined {
  return s?.toLowerCase().replace(/\s+/g, "");
}

export function matchUsersByNameOrEmail(identifier: string, usersList: PumbleUser[]): PumbleUser[] {
  const lowerTarget = identifier.toLowerCase();

  // Phase 1: Exact Email
  const exactEmailMatches = usersList.filter((u) => u.email?.toLowerCase() === lowerTarget);
  if (exactEmailMatches.length > 0) return exactEmailMatches;

  // Phase 2: Exact Name
  const exactNameMatches = usersList.filter(
    (u) => u.name?.toLowerCase() === lowerTarget || u.realName?.toLowerCase() === lowerTarget,
  );
  if (exactNameMatches.length > 0) return exactNameMatches;

  // Phase 3: Substring Name (space-insensitive)
  const normalizedTarget = normalize(identifier)!;
  return usersList.filter((u) => {
    const name = normalize(u.name);
    const realName = normalize(u.realName);
    return (name && name.includes(normalizedTarget)) || (realName && realName.includes(normalizedTarget));
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

  const wasCached = channelCache !== null;
  let channelsList = await getChannelsList();
  let matches = matchChannelsByName(identifier, channelsList);

  if (matches.length === 0 && wasCached) {
    // Smart Lookup: Cache miss. Re-fetch in case it's a brand new channel
    channelsList = await getChannelsList(true);
    matches = matchChannelsByName(identifier, channelsList);
  }

  if (matches.length === 1) {
    return matches[0].channel!.id;
  }
  if (matches.length > 1) {
    throw new Error(
      `'${identifier}' matches multiple channels in the workspace: ${describeChannelCandidates(matches)}. Provide the exact channel ID instead.` + TERMINATION_GUARDRAIL,
    );
  }

  throw new Error(`Channel with name '${identifier}' could not be found in the workspace.` + TERMINATION_GUARDRAIL);
}

/**
 * Resolve a user ID to the ID of the DM channel with that user. Pumble only
 * creates a DM channel once a message has been sent, so there is nothing to
 * target for someone the workspace has never messaged.
 */
export async function resolveDmChannelId(userId: string): Promise<string> {
  const wasCached = channelCache !== null;
  let channelsList = await getChannelsList();

  const findDm = (channels: PumbleChannelListItem[]) => {
    const selfChannel = channels.find((c) => c.channel?.channelType === "SELF");
    if (selfChannel?.channel?.id && selfChannel.users?.[0] === userId) return selfChannel.channel.id;
    const directChannel = channels.find((c) => c.channel?.channelType === "DIRECT" && c.users?.includes(userId));
    return directChannel?.channel?.id;
  };

  let dmId = findDm(channelsList);
  if (!dmId && wasCached) {
    // Smart Lookup: Cache miss. Re-fetch in case DM was just created
    channelsList = await getChannelsList(true);
    dmId = findDm(channelsList);
  }

  if (!dmId) {
    throw new Error(
      `No existing DM channel with user '${userId}'. Send them a direct message first, then schedule.` + TERMINATION_GUARDRAIL,
    );
  }
  return dmId;
}

/**
 * Resolve a user name, email, or ID to a user ID. Throws if the identifier
 * matches zero or more than one user, rather than silently guessing.
 */
export async function resolveUserId(identifier: string): Promise<string> {
  if (isLikelyId(identifier)) return identifier;

  const wasCached = userCache !== null;
  let usersList = await getUsersList();
  let activeUsersList = usersList.filter((u) => u.status !== "DEACTIVATED");
  let activeMatches = matchUsersByNameOrEmail(identifier, activeUsersList);

  if (activeMatches.length === 0 && wasCached) {
    // Smart Lookup: Cache miss. Re-fetch in case it's a new user
    usersList = await getUsersList(true);
    activeUsersList = usersList.filter((u) => u.status !== "DEACTIVATED");
    activeMatches = matchUsersByNameOrEmail(identifier, activeUsersList);
  }

  if (activeMatches.length === 0) {
    const matchedDeactivatedUser = matchUsersByNameOrEmail(identifier, usersList).some(
      (u) => u.status === "DEACTIVATED",
    );
    if (matchedDeactivatedUser) {
      throw new Error(`User '${identifier}' is deactivated and cannot be resolved.` + TERMINATION_GUARDRAIL);
    }
    throw new Error(`User '${identifier}' could not be found in the workspace.` + TERMINATION_GUARDRAIL);
  }

  if (activeMatches.length > 1) {
    throw new Error(
      `'${identifier}' matches multiple users in the workspace: ${describeUserCandidates(activeMatches)}. Provide the exact user ID instead.` + TERMINATION_GUARDRAIL,
    );
  }
  return activeMatches[0].id;
}

export function clearCache() {
  channelCache = null;
  userCache = null;
}

