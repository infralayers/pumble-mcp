import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChannel, getChannelSchema } from "../../src/tools/getChannel.js";

describe("getChannelSchema", () => {
  it("rejects when neither channel nor channelId is given", () => {
    expect(getChannelSchema.safeParse({}).success).toBe(false);
  });

  it("rejects when both channel and channelId are given", () => {
    expect(
      getChannelSchema.safeParse({ channel: "general", channelId: "abc" }).success,
    ).toBe(false);
  });

  it("accepts when only channelId is given", () => {
    expect(getChannelSchema.safeParse({ channelId: "abc" }).success).toBe(true);
  });

  it("accepts when only channel is given", () => {
    expect(getChannelSchema.safeParse({ channel: "general" }).success).toBe(true);
  });
});

describe("getChannel", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("builds the query string correctly when given channelId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "abc", name: "general" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = getChannelSchema.parse({ channelId: "abc" });
    const result = await getChannel(input);

    expect(result).toEqual({ id: "abc", name: "general" });
    const [url] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://pumble-api-keys.addons.marketplace.cake.com/getChannel?channelId=abc",
    );
  });

  it("resolves channel name to ID and calls the API", async () => {
    // We mock fetch twice. The first one will be called by listChannels internally.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([
          { channel: { id: "def", name: "general" } },
          { channel: { id: "abc", name: "random" } }
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "def", name: "general" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const input = getChannelSchema.parse({ channel: "general" });
    const result = await getChannel(input);

    expect(result).toEqual({ id: "def", name: "general" });
    
    // Check the second fetch call url (first was listChannels)
    const [url] = fetchMock.mock.calls[1];
    expect(url.toString()).toBe(
      "https://pumble-api-keys.addons.marketplace.cake.com/getChannel?channelId=def",
    );
  });

  it("throws an error if channel name cannot be resolved", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([]),
      });
    vi.stubGlobal("fetch", fetchMock);

    const input = getChannelSchema.parse({ channel: "nonexistent" });
    await expect(getChannel(input)).rejects.toThrow(/Channel with name 'nonexistent' could not be found/);
  });
});
