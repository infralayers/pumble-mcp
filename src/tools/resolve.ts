import { listChannels } from "./listChannels.js";
import { listUsers } from "./listUsers.js";
import { pumbleRequest } from "../pumbleClient.js";

const ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// === SMART CACHE ===
export let channelCache: PumbleChannelListItem[] | null = null;
export let userCache: PumbleUser[] | null = null;
export let myInfoCache: any | null = null;

export async function getChannelsList(forceRefresh = false): Promise<PumbleChannelListItem[]> {
  if (channelCache && !forceRefresh) return channelCache;
  const raw = await listChannels({});
  channelCache = (Array.isArray(raw) ? raw : []).map((c: any) => ({
    channel: {
      id: c.channel?.id,
      name: c.channel?.name,
      channelType: c.channel?.channelType,
      isArchived: Boolean(c.channel?.isArchived),
    },
    users: c.users,
  })) as PumbleChannelListItem[];
  return channelCache;
}

export async function getUsersList(forceRefresh = false): Promise<PumbleUser[]> {
  if (userCache && !forceRefresh) return userCache;
  const raw = await listUsers({});
  userCache = (Array.isArray(raw) ? raw : []).map((u: any) => ({
    id: u.id, name: u.name, realName: u.realName, email: u.email, status: u.status,
  })) as PumbleUser[];
  return userCache;
}

export async function getMyInfoCached(forceRefresh = false): Promise<any> {
  if (myInfoCache && !forceRefresh) return myInfoCache;
  myInfoCache = await pumbleRequest<any>("/myInfo", { method: "GET" });
  return myInfoCache;
}

export async function prefetchIdentifiers(): Promise<void> {
  try {
    await Promise.all([
      getChannelsList(true),
      getUsersList(true),
      getMyInfoCached(true),
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
    isArchived?: boolean;
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

/** Normalizes a channel name by stripping leading '#' and mapping spaces, underscores, and multiple hyphens to a single hyphen */
export function normalizeSlug(s?: string): string {
  if (!s) return "";
  return s
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function matchChannelsByName(identifier: string, channelsList: PumbleChannelListItem[]): PumbleChannelListItem[] {
  const lower = identifier.trim().toLowerCase();
  const stripped = lower.replace(/^#+/, "");

  // Phase 1: Exact Match (case-insensitive, with or without leading '#')
  const exactMatches = channelsList.filter((c) => {
    const cName = c.channel?.name?.toLowerCase();
    return cName === lower || cName === stripped;
  });
  if (exactMatches.length > 0) return exactMatches;

  // Phase 2: Slug Match (space/hyphen/underscore normalized)
  const targetSlug = normalizeSlug(identifier);
  if (targetSlug) {
    const slugMatches = channelsList.filter((c) => normalizeSlug(c.channel?.name) === targetSlug);
    if (slugMatches.length > 0) return slugMatches;
  }

  // Phase 3: Substring Slug Match (if target has at least 3 characters)
  if (targetSlug && targetSlug.length >= 3) {
    const substringMatches = channelsList.filter((c) => {
      const cSlug = normalizeSlug(c.channel?.name);
      return cSlug.includes(targetSlug);
    });
    if (substringMatches.length > 0) return substringMatches;
  }

  return [];
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

  const getActiveMatches = (list: PumbleChannelListItem[]) => {
    const active = list.filter((c) => !c.channel?.isArchived);
    return matchChannelsByName(identifier, active);
  };

  let matches = getActiveMatches(channelsList);

  if (matches.length === 0 && wasCached) {
    // Smart Lookup: Cache miss. Re-fetch in case it's a brand new channel
    channelsList = await getChannelsList(true);
    matches = getActiveMatches(channelsList);
  }

  if (matches.length === 1) {
    return matches[0].channel!.id;
  }
  if (matches.length > 1) {
    throw new Error(
      `'${identifier}' matches multiple channels in the workspace: ${describeChannelCandidates(matches)}. Provide the exact channel ID instead.`,
    );
  }

  // Check if target is an archived channel
  const archivedMatches = matchChannelsByName(
    identifier,
    channelsList.filter((c) => c.channel?.isArchived),
  );
  if (archivedMatches.length > 0) {
    throw new Error(`Channel '${identifier}' is archived and cannot be targeted.`);
  }

  const available = channelsList
    .filter((c) => !c.channel?.isArchived)
    .map((c) => `#${c.channel?.name}`)
    .filter(Boolean)
    .join(", ");
  const hint = available ? ` Available channels: ${available}.` : "";
  throw new Error(`Channel with name '${identifier}' could not be found in the workspace.${hint}`);
}

/**
 * Resolve a user ID to the ID of the DM channel with that user. Pumble only
 * creates a DM channel once a message has been sent, so there is nothing to
 * target for someone the workspace has never messaged.
 */
export async function resolveDmChannelId(userId: string): Promise<string> {
  const wasCached = channelCache !== null;
  let channelsList = await getChannelsList();
  const myInfo = await getMyInfoCached();

  const findDm = (channels: PumbleChannelListItem[]) => {
    if (myInfo?.id && userId === myInfo.id) {
      const selfChannel = channels.find((c) => c.channel?.channelType === "SELF");
      if (selfChannel?.channel?.id) return selfChannel.channel.id;
    }
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
      `No existing DM channel with user '${userId}'. Send them a direct message first, then schedule.`,
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
      throw new Error(`User '${identifier}' is deactivated and cannot be resolved.`);
    }
    throw new Error(`User '${identifier}' could not be found in the workspace.`);
  }

  if (activeMatches.length > 1) {
    throw new Error(
      `'${identifier}' matches multiple users in the workspace: ${describeUserCandidates(activeMatches)}. Provide the exact user ID instead.`,
    );
  }
  return activeMatches[0].id;
}

export function clearCache() {
  channelCache = null;
  userCache = null;
  myInfoCache = null;
}

export function updateCachedCustomStatus(status: {
  code: string;
  status: string;
  expiration: string;
  expiresAt: number;
}) {
  if (myInfoCache) {
    myInfoCache.customStatus = {
      code: status.code,
      status: status.status,
      expiration: status.expiration,
      expiresAt: status.expiresAt,
    };
  }
}

export function addUsersToCachedChannel(channelId: string, userIds: string[]) {
  if (channelCache) {
    const item = channelCache.find((c) => c.channel?.id === channelId);
    if (item) {
      if (!item.users) item.users = [];
      for (const uid of userIds) {
        if (!item.users.includes(uid)) {
          item.users.push(uid);
        }
      }
    }
  }
}

export function removeUserFromCachedChannel(channelId: string, userId: string) {
  if (channelCache) {
    const item = channelCache.find((c) => c.channel?.id === channelId);
    if (item && item.users) {
      item.users = item.users.filter((id) => id !== userId);
    }
  }
}

export function addChannelToCache(channel: { id?: string; name?: string; channelType?: string }) {
  if (channelCache && channel.id) {
    channelCache.push({
      channel: {
        id: channel.id,
        name: channel.name,
        channelType: channel.channelType || "PUBLIC",
        isArchived: false,
      },
      users: [],
    });
  }
}

