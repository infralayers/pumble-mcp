import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChannel, getChannelSchema } from "../../src/tools/getChannel.js";

describe("getChannelSchema", () => {
  it("rejects when channelIdentifier is missing", () => {
    expect(getChannelSchema.safeParse({}).success).toBe(false);
  });

    it("accepts when only channelId is given", () => {
    expect(getChannelSchema.safeParse({ channelIdentifier: "507f1f77bcf86cd799439011" }).success).toBe(true);
  });

  it("accepts when only channel is given", () => {
    expect(getChannelSchema.safeParse({ channelIdentifier: "general" }).success).toBe(true);
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "abc", name: "general", users: ["testuser1"] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([{ id: "testuser1", name: "Test User", email: "test@example.com" }]),
      });
    vi.stubGlobal("fetch", fetchMock);

    const input = getChannelSchema.parse({ channelIdentifier: "507f1f77bcf86cd799439011" });
    const result = await getChannel(input);

    expect(result).toEqual({ 
      id: "abc", 
      name: "general", 
      users: ["testuser1"], 
      memberDetails: [{ id: "testuser1", name: "Test User", email: "test@example.com" }] 
    });
    
    const [url] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://pumble-api-keys.addons.marketplace.cake.com/getChannel?channelId=507f1f77bcf86cd799439011",
    );
  });

  it("resolves channel name to ID and calls the API", async () => {
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
        text: async () => JSON.stringify({ id: "def", name: "general", users: ["testuser2"] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([{ id: "testuser2", name: "Jane Doe", email: "jane@example.com" }]),
      });
    vi.stubGlobal("fetch", fetchMock);

    const input = getChannelSchema.parse({ channelIdentifier: "general" });
    const result = await getChannel(input);

    expect(result).toEqual({ 
      id: "def", 
      name: "general", 
      users: ["testuser2"],
      memberDetails: [{ id: "testuser2", name: "Jane Doe", email: "jane@example.com" }]
    });
    
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

    const input = getChannelSchema.parse({ channelIdentifier: "nonexistent" });
    await expect(getChannel(input)).rejects.toThrow(/Channel with name 'nonexistent' could not be found/);
  });
});
