import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { removeUserFromChannel, removeUserFromChannelSchema } from "../../src/tools/removeUserFromChannel.js";

describe("removeUserFromChannelSchema", () => {
  it("rejects when channelIdentifier is missing", () => {
    expect(removeUserFromChannelSchema.safeParse({ userIdentifier: "usr1", confirm: true }).success).toBe(false);
  });

  it("rejects when user is missing", () => {
    expect(removeUserFromChannelSchema.safeParse({ channelIdentifier: "c1", confirm: true }).success).toBe(false);
  });

  it("rejects when confirm is missing or false", () => {
    expect(removeUserFromChannelSchema.safeParse({ channelIdentifier: "c1", userIdentifier: "usr1" }).success).toBe(false);
    expect(removeUserFromChannelSchema.safeParse({ channelIdentifier: "c1", userIdentifier: "usr1", confirm: false }).success).toBe(false);
  });

  it("accepts valid input with confirm: true", () => {
    expect(removeUserFromChannelSchema.safeParse({ channelIdentifier: "c1", userIdentifier: "usr1", confirm: true }).success).toBe(true);
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
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "chan1" } }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ id: "usr1", name: "Aliyan Hammad" }]) });
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = removeUserFromChannelSchema.parse({
      channelIdentifier: "chan1",
      userIdentifier: "Aliyan Hammad",
      confirm: true
    });
    
    await removeUserFromChannel(input);
    const removeOptions = fetchMock.mock.calls.find((c: any) => c[0].toString().includes("removeUserFromChannel"))[1];
    const body = JSON.parse(removeOptions.body);
    expect(body.channelId).toBe("chan1");
    expect(body.userId).toBe("usr1");
  });

  it("throws an error if user resolution fails", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "chan1" } }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([]) });
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = removeUserFromChannelSchema.parse({
      channelIdentifier: "chan1",
      userIdentifier: "Ghost User",
      confirm: true
    });
    await expect(removeUserFromChannel(input)).rejects.toThrow(/User not found for 'Ghost User'/);
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

    const input = removeUserFromChannelSchema.parse({
      channelIdentifier: "chan1",
      userIdentifier: "AbdulRehman",
      confirm: true,
    });
    await expect(removeUserFromChannel(input)).rejects.toThrow(/Ambiguous name 'AbdulRehman'/);
  });

  it("throws an error if the channel name cannot be resolved", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "chan1" } }]) });
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = removeUserFromChannelSchema.parse({
      channelIdentifier: "nonexistent-channel",
      userIdentifier: "usr1",
      confirm: true,
    });
    await expect(removeUserFromChannel(input)).rejects.toThrow(/Channel with name 'nonexistent-channel' could not be found/);
  });

  it("resolves the user by name case-insensitively", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "chan1" } }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ id: "usr1", name: "Aliyan Hammad" }]) });
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = removeUserFromChannelSchema.parse({
      channelIdentifier: "chan1",
      userIdentifier: "ALIYAN HAMMAD",
      confirm: true,
    });
    await removeUserFromChannel(input);
    const removeOptions = fetchMock.mock.calls.find((c: any) => c[0].toString().includes("removeUserFromChannel"))[1];
    expect(JSON.parse(removeOptions.body).userId).toBe("usr1");
  });
});
