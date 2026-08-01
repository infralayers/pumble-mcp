import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { removeUserFromChannel, removeUserFromChannelSchema } from "../../src/tools/removeUserFromChannel.js";

describe("removeUserFromChannelSchema", () => {
  it("rejects when neither channel nor channelId is given", () => {
    expect(removeUserFromChannelSchema.safeParse({ user: "usr1", confirm: true }).success).toBe(false);
  });

  it("rejects when both channel and channelId are given", () => {
    expect(
      removeUserFromChannelSchema.safeParse({ channel: "general", channelId: "abc", user: "usr1", confirm: true }).success,
    ).toBe(false);
  });

  it("rejects when user is missing", () => {
    expect(removeUserFromChannelSchema.safeParse({ channelId: "abc", confirm: true }).success).toBe(false);
  });

  it("rejects when confirm is missing or false", () => {
    expect(removeUserFromChannelSchema.safeParse({ channelId: "abc", user: "usr1" }).success).toBe(false);
    expect(removeUserFromChannelSchema.safeParse({ channelId: "abc", user: "usr1", confirm: false }).success).toBe(false);
  });

  it("accepts valid input with confirm: true", () => {
    expect(removeUserFromChannelSchema.safeParse({ channelId: "abc", user: "usr1", confirm: true }).success).toBe(true);
  });
});

describe("removeUserFromChannel", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("resolves channel and user, then makes the API call", async () => {
    // Mock for listChannels, listUsers, and removeUserFromChannel
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ // listChannels
        ok: true,
        text: async () => JSON.stringify([
          { channel: { id: "chan1", name: "general" } }
        ]),
      })
      .mockResolvedValueOnce({ // listUsers
        ok: true,
        text: async () => JSON.stringify([
          { id: "usr1", name: "Jordan Blake" }
        ]),
      })
      .mockResolvedValueOnce({ // removeUserFromChannel
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      });
      
    vi.stubGlobal("fetch", fetchMock);

    const input = removeUserFromChannelSchema.parse({
      channel: "general",
      user: "Jordan Blake",
      confirm: true
    });
    
    await removeUserFromChannel(input);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [removeUrl, removeOptions] = fetchMock.mock.calls[2];
    
    expect(removeUrl.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/removeUserFromChannel");
    expect(removeOptions.method).toBe("POST");
    
    const body = JSON.parse(removeOptions.body as string);
    expect(body.channelId).toBe("chan1");
    expect(body.userId).toBe("usr1");
  });

  it("throws an error if user resolution fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ // listUsers
        ok: true,
        text: async () => JSON.stringify([]),
      });
      
    vi.stubGlobal("fetch", fetchMock);

    const input = removeUserFromChannelSchema.parse({
      channelId: "chan1",
      user: "Ghost User",
      confirm: true
    });
    
    await expect(removeUserFromChannel(input)).rejects.toThrow(/User 'Ghost User' could not be found/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws an error instead of silently picking a match when the name is ambiguous", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ // listUsers
        ok: true,
        text: async () => JSON.stringify([
          { id: "usr1", name: "Casey Morgan", email: "casey.old@example.com" },
          { id: "usr2", name: "Casey Morgan", email: "casey.new@example.com" },
        ]),
      });

    vi.stubGlobal("fetch", fetchMock);

    const input = removeUserFromChannelSchema.parse({
      channelId: "chan1",
      user: "Casey Morgan",
      confirm: true,
    });

    await expect(removeUserFromChannel(input)).rejects.toThrow(/matches multiple users/);
    // Must not call the removal API when the target is ambiguous
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws an error if the channel name cannot be resolved", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ // listChannels
        ok: true,
        text: async () => JSON.stringify([{ channel: { id: "chan1", name: "general" } }]),
      });

    vi.stubGlobal("fetch", fetchMock);

    const input = removeUserFromChannelSchema.parse({
      channel: "nonexistent-channel",
      user: "usr1",
      confirm: true,
    });

    await expect(removeUserFromChannel(input)).rejects.toThrow(/Channel with name 'nonexistent-channel' could not be found/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves the user by name case-insensitively", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ // listUsers
        ok: true,
        text: async () => JSON.stringify([{ id: "usr1", name: "Jordan Blake" }]),
      })
      .mockResolvedValueOnce({ // removeUserFromChannel
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const input = removeUserFromChannelSchema.parse({
      channelId: "chan1",
      user: "JORDAN BLAKE",
      confirm: true,
    });

    await removeUserFromChannel(input);

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.userId).toBe("usr1");
  });
});
