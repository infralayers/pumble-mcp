import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addUsersToChannel, addUsersToChannelSchema } from "../../src/tools/addUsersToChannel.js";

describe("addUsersToChannelSchema", () => {
  it("rejects when neither channel nor channelId is given", () => {
    expect(addUsersToChannelSchema.safeParse({ users: ["user1"] }).success).toBe(false);
  });

  it("rejects when both channel and channelId are given", () => {
    expect(
      addUsersToChannelSchema.safeParse({ channel: "general", channelId: "abc", users: ["user1"] }).success,
    ).toBe(false);
  });

  it("rejects when users array is missing or empty", () => {
    expect(addUsersToChannelSchema.safeParse({ channelId: "abc" }).success).toBe(false);
    expect(addUsersToChannelSchema.safeParse({ channelId: "abc", users: [] }).success).toBe(false);
  });

  it("accepts valid input with channelId and users", () => {
    expect(addUsersToChannelSchema.safeParse({ channelId: "abc", users: ["user1", "user2"] }).success).toBe(true);
  });
});

describe("addUsersToChannel", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("resolves channel name and user names/emails successfully", async () => {
    // Mock for listChannels, listUsers, and addUsersToChannel
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
          { id: "usr1", name: "Aliyan Hammad", email: "aliyan@example.com" },
          { id: "usr2", name: "Nouman Tariq", email: "nouman@example.com" }
        ]),
      })
      .mockResolvedValueOnce({ // addUsersToChannel
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      });
      
    vi.stubGlobal("fetch", fetchMock);

    const input = addUsersToChannelSchema.parse({
      channel: "general",
      users: ["aliyan@example.com", "Nouman Tariq", "123456789012345678901234"], // 1 email, 1 name, 1 raw ID
    });
    
    await addUsersToChannel(input);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [addUsersUrl, addUsersOptions] = fetchMock.mock.calls[2];
    
    expect(addUsersUrl.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/addUsersToChannel");
    expect(addUsersOptions.method).toBe("POST");
    
    const body = JSON.parse(addUsersOptions.body as string);
    expect(body.channelId).toBe("chan1");
    expect(body.userIds).toContain("usr1");
    expect(body.userIds).toContain("usr2");
    expect(body.userIds).toContain("123456789012345678901234");
  });

  it("throws an error if a user cannot be resolved", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ // listUsers
        ok: true,
        text: async () => JSON.stringify([
          { id: "usr1", name: "Aliyan Hammad" }
        ]),
      });
      
    vi.stubGlobal("fetch", fetchMock);

    const input = addUsersToChannelSchema.parse({
      channelId: "chan1",
      users: ["Aliyan Hammad", "Ghost User"],
    });
    
    await expect(addUsersToChannel(input)).rejects.toThrow(/User 'Ghost User' could not be found/);
    // API should not be called if resolution fails
    expect(fetchMock).toHaveBeenCalledTimes(1); 
  });
});
