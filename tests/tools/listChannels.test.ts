import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearListChannelsCache, listChannels } from "../../src/tools/listChannels.js";

describe("listChannels", () => {
  beforeEach(() => {
    clearListChannelsCache();
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    clearListChannelsCache();
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls GET /listChannels with no params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ channel: { id: "1", name: "test-channel" } }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listChannels({});

    expect(result).toEqual([
      {
        id: "1",
        name: "test-channel",
        type: undefined,
        isArchived: false,
        creator: undefined,
        createdAt: undefined,
        memberCount: 0,
      },
    ]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/listChannels");
    expect(options.method).toBe("GET");
  });

  it("serves from memory cache on subsequent calls within 60 seconds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ channel: { id: "1", name: "test-channel" } }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listChannels({});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Call 2: Within 60 seconds -> serves from memory cache, 0 network calls!
    const cachedResult = await listChannels({});
    expect(cachedResult).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
