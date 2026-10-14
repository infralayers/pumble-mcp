import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isLikelyId,
  matchChannelsByName,
  matchUsersByNameOrEmail,
  resolveChannelId,
  resolveUserId,
  resolveDmChannelId,
  getMyInfoCached,
  clearCache,
  getChannelsList,
  addUsersToCachedChannel,
  removeUserFromCachedChannel,
  addChannelToCache,
  updateCachedCustomStatus,
} from "../../src/tools/resolve.js";

describe("isLikelyId", () => {
  it("recognizes 24-char hex strings as IDs", () => {
    expect(isLikelyId("507f1f77bcf86cd799439011")).toBe(true);
  });

  it("rejects names and emails", () => {
    expect(isLikelyId("general")).toBe(false);
    expect(isLikelyId("a@b.com")).toBe(false);
    expect(isLikelyId("507f1f77bcf86cd79943901")).toBe(false); // 23 chars
    expect(isLikelyId("u1")).toBe(false);
  });
});

describe("matchChannelsByName / matchUsersByNameOrEmail", () => {
  it("matches case-insensitively", () => {
    const channels = [{ channel: { id: "c1", name: "General" } }];
    expect(matchChannelsByName("general", channels)).toHaveLength(1);

    const users = [{ id: "u1", name: "Jordan Blake", email: "jordan@example.com" }];
    expect(matchUsersByNameOrEmail("JORDAN@EXAMPLE.COM", users)).toHaveLength(1);
  });

  it("matches channels with leading hash, spaces, underscores, and substrings", () => {
    const channels = [
      { channel: { id: "c1", name: "General" } },
      { channel: { id: "c2", name: "office-work" } },
      { channel: { id: "c3", name: "marketing-announcements" } },
    ];
    // Strips leading '#'
    expect(matchChannelsByName("#general", channels)).toHaveLength(1);
    expect(matchChannelsByName("#General", channels)).toHaveLength(1);

    // Spaces and underscores normalize to hyphenated slug
    expect(matchChannelsByName("office work", channels)).toHaveLength(1);
    expect(matchChannelsByName("office_work", channels)).toHaveLength(1);
    expect(matchChannelsByName("#office work", channels)).toHaveLength(1);

    // Substring match
    expect(matchChannelsByName("marketing", channels)).toHaveLength(1);
  });

  it("returns every match when a name is ambiguous", () => {
    const users = [
      { id: "u1", name: "Casey Morgan", email: "casey.old@example.com" },
      { id: "u2", name: "Casey Morgan", email: "casey.new@example.com" },
    ];
    expect(matchUsersByNameOrEmail("Casey Morgan", users)).toHaveLength(2);
  });

  it("supports 3-phase matching and returns deactivated users", () => {
    const users = [
      { id: "u1", name: "Bob Builder", email: "bob@example.com", status: "DEACTIVATED" },
      { id: "u2", name: "Alice", email: "alice@example.com" }
    ];
    // Exact Email
    expect(matchUsersByNameOrEmail("bob@example.com", users)).toHaveLength(1);
    // Exact Name
    expect(matchUsersByNameOrEmail("bob builder", users)).toHaveLength(1);
    // Substring Name
    expect(matchUsersByNameOrEmail("builder", users)).toHaveLength(1);
  });
});

describe("resolveChannelId / resolveUserId", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
    clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("resolveChannelId passes raw IDs through without a fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveChannelId("507f1f77bcf86cd799439011")).resolves.toBe("507f1f77bcf86cd799439011");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolveUserId throws on zero matches", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify([]) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUserId("Ghost User")).rejects.toThrow(/Ghost User' could not be found/);
  });

  it("resolveUserId throws on ambiguous matches", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { id: "u1", name: "Casey Morgan", email: "casey.old@example.com" },
          { id: "u2", name: "Casey Morgan", email: "casey.new@example.com" },
        ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUserId("Casey Morgan")).rejects.toThrow(/'Casey Morgan' matches multiple users/);
  });

  it("resolveUserId throws when resolving an exact email of a DEACTIVATED user", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([
        { id: "u1", name: "Deactivated Bob", email: "bob@example.com", status: "DEACTIVATED" }
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUserId("bob@example.com")).rejects.toThrow(/is deactivated/);
  });

  it("resolveUserId filters out DEACTIVATED users during name matching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([
        { id: "u1", name: "Bob", email: "bob.old@example.com", status: "DEACTIVATED" },
        { id: "u2", name: "Bob", email: "bob.new@example.com", status: "ACTIVE" }
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    // It should successfully resolve to u2 because u1 is deactivated and filtered out, leaving exactly 1 match!
    await expect(resolveUserId("Bob")).resolves.toBe("u2");
  });

  it("resolveChannelId returns the single match's id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ channel: { id: "c1", name: "general" } }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveChannelId("general")).resolves.toBe("c1");
  });

  it("resolves from cache on second call (Cache Hit)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ channel: { id: "c_cache", name: "cache-test" } }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Call 1: Misses cache, fetches from network
    await expect(resolveChannelId("cache-test")).resolves.toBe("c_cache");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Call 2: Hits cache, no network fetch
    await expect(resolveChannelId("cache-test")).resolves.toBe("c_cache");
    expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1!
  });

  it("forces a network fetch on Cache Miss for a new channel", async () => {
    // Setup a cache with some other channel first
    let fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ channel: { id: "c_old", name: "old-channel" } }]),
    });
    vi.stubGlobal("fetch", fetchMock);
    await resolveChannelId("old-channel"); // populates cache
    
    // Now look for a brand new channel not in cache
    // Mock the fetch to now return the new channel
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([
         { channel: { id: "c_old", name: "old-channel" } },
         { channel: { id: "c_new", name: "new-channel" } }
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Call: Misses cache, falls back to network, finds it!
    await expect(resolveChannelId("new-channel")).resolves.toBe("c_new");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolveChannelId reports available channels on miss without prompt injections", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { channel: { id: "c1", name: "office-work" } },
          { channel: { id: "c2", name: "general" } },
        ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveChannelId("home work")).rejects.toThrow(
      "Channel with name 'home work' could not be found in the workspace. Available channels: #office-work, #general."
    );
  });

  it("throws when resolving an archived channel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { channel: { id: "c_archived", name: "old-archive", isArchived: true } },
          { channel: { id: "c_active", name: "active-channel", isArchived: false } },
        ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveChannelId("old-archive")).rejects.toThrow(
      "Channel 'old-archive' is archived and cannot be targeted."
    );
  });

  it("caches myInfo in memory and resolves in 0ms on subsequent calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "u_me", name: "My Bot", email: "bot@example.com" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const info1 = await getMyInfoCached();
    expect(info1.id).toBe("u_me");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const info2 = await getMyInfoCached();
    expect(info2.id).toBe("u_me");
    expect(fetchMock).toHaveBeenCalledTimes(1); // 0ms cache hit
  });

  it("resolves self channel for current bot user using cached myInfo", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/myInfo")) {
        return Promise.resolve({ ok: true, text: async () => JSON.stringify({ id: "u_bot" }) });
      }
      if (u.includes("/listChannels")) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify([
              { channel: { id: "c_self", channelType: "SELF" } },
              { channel: { id: "c_dm", channelType: "DIRECT" }, users: ["u_other"] },
            ]),
        });
      }
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const selfDmId = await resolveDmChannelId("u_bot");
    expect(selfDmId).toBe("c_self");
  });

  it("updates cached channel users in-place without invalidating cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ channel: { id: "c1", name: "general" }, users: ["u1"] }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const list = await getChannelsList(true);
    expect(list[0].users).toEqual(["u1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    addUsersToCachedChannel("c1", ["u2"]);
    const updatedList = await getChannelsList();
    expect(updatedList[0].users).toEqual(["u1", "u2"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    removeUserFromCachedChannel("c1", "u1");
    const afterRemoveList = await getChannelsList();
    expect(afterRemoveList[0].users).toEqual(["u2"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds newly created channel to cache in-place", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ channel: { id: "c1", name: "general" } }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getChannelsList(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    addChannelToCache({ id: "c_new", name: "new-channel", channelType: "PUBLIC" });
    const resolvedId = await resolveChannelId("new-channel");
    expect(resolvedId).toBe("c_new");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("updates cached custom status in myInfoCache in-place", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "u_me", name: "My Bot", customStatus: { status: "old" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const info1 = await getMyInfoCached(true);
    expect(info1.customStatus.status).toBe("old");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    updateCachedCustomStatus({
      code: ":smile:",
      status: "new status",
      expiration: "never",
      expiresAt: 4093062627467,
    });

    const info2 = await getMyInfoCached();
    expect(info2.customStatus.status).toBe("new status");
    expect(info2.customStatus.code).toBe(":smile:");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
