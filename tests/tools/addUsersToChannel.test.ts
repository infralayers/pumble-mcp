import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addUsersToChannel, addUsersToChannelSchema } from "../../src/tools/addUsersToChannel.js";

describe("addUsersToChannelSchema", () => {
  it("rejects when channelIdentifier is missing", () => {
    expect(addUsersToChannelSchema.safeParse({ userIdentifiers: ["user1"] }).success).toBe(false);
  });

  it("rejects when users array is missing or empty", () => {
    expect(addUsersToChannelSchema.safeParse({ channelIdentifier: "c1" }).success).toBe(false);
    expect(addUsersToChannelSchema.safeParse({ channelIdentifier: "c1", userIdentifiers: [] }).success).toBe(false);
  });

  it("accepts valid input with channelId and users", () => {
    expect(addUsersToChannelSchema.safeParse({ channelIdentifier: "c1", userIdentifiers: ["user1", "user2"] }).success).toBe(true);
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
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "chan1" } }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([
        { id: "usr1", name: "Aliyan Hammad", email: "aliyan@example.com" },
        { id: "usr2", name: "Nouman Tariq", email: "nouman@example.com" }
      ]) });
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = addUsersToChannelSchema.parse({
      channelIdentifier: "chan1",
      userIdentifiers: ["aliyan@example.com", "Nouman Tariq", "123456789012345678901234"],
    });
    await addUsersToChannel(input);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [addUsersUrl, addUsersOptions] = fetchMock.mock.calls[3];
    expect(addUsersUrl.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/addUsersToChannel");
    const body = JSON.parse(addUsersOptions.body);
    expect(body.channelId).toBe("chan1");
    expect(body.userIds).toContain("usr1");
    expect(body.userIds).toContain("usr2");
    expect(body.userIds).toContain("123456789012345678901234");
  });

  it("throws an error if a user cannot be resolved", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "chan1" } }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ id: "usr1", name: "Aliyan Hammad" }]) });
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = addUsersToChannelSchema.parse({
      channelIdentifier: "chan1",
      userIdentifiers: ["Aliyan Hammad", "Ghost User"],
    });
    
    await expect(addUsersToChannel(input)).rejects.toThrow(/User not found for 'Ghost User'/);
  });

  it("throws an error instead of silently picking a match when the name is ambiguous", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "chan1" } }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([
        { id: "usr1", name: "AbdulRehman", email: "abdul.old@example.com" },
        { id: "usr2", name: "AbdulRehman", email: "abdul.new@example.com" },
      ]) });
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = addUsersToChannelSchema.parse({
      channelIdentifier: "chan1",
      userIdentifiers: ["AbdulRehman"],
    });

    await expect(addUsersToChannel(input)).rejects.toThrow(/Ambiguous name/);
  });

  it("throws an error if the channel name cannot be resolved", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "chan1" } }]) });
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = addUsersToChannelSchema.parse({
      channelIdentifier: "nonexistent-channel",
      userIdentifiers: ["usr1"],
    });

    await expect(addUsersToChannel(input)).rejects.toThrow(/Channel with name 'nonexistent-channel' could not be found/);
  });

  it("resolves users by name and email case-insensitively", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "chan1" } }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ id: "usr1", name: "Aliyan Hammad", email: "aliyan@example.com" }]) });
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = addUsersToChannelSchema.parse({
      channelIdentifier: "chan1",
      userIdentifiers: ["ALIYAN HAMMAD"],
    });
    await addUsersToChannel(input);

    const body = JSON.parse(fetchMock.mock.calls.find((c: any) => c[0].toString().includes("addUsersToChannel"))[1].body);
    expect(body.userIds).toEqual(["usr1"]);
  });
});
