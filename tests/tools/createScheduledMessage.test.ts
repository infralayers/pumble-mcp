import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduledMessage, createScheduledMessageSchema } from "../../src/tools/createScheduledMessage.js";

describe("createScheduledMessageSchema", () => {
  it("rejects when neither channelIdentifier nor userIdentifier is missing", () => {
    const res = createScheduledMessageSchema.safeParse({ text: "hello", sendAt: 1784620000000 });
    expect(res.success).toBe(false);
  });

  it("rejects when both channelIdentifier and userIdentifier are provided", () => {
    const res = createScheduledMessageSchema.safeParse({ channelIdentifier: "general", userIdentifier: "usr1", text: "hello", sendAt: 1784620000000 });
    expect(res.success).toBe(false);
  });

  it("rejects when text is missing", () => {
    const res = createScheduledMessageSchema.safeParse({ channelIdentifier: "general", sendAt: 1784620000000 });
    expect(res.success).toBe(false);
  });

  it("rejects when sendAt is missing", () => {
    const res = createScheduledMessageSchema.safeParse({ channelIdentifier: "general", text: "hello" });
    expect(res.success).toBe(false);
  });

  it("accepts valid input with channelIdentifier", () => {
    const res = createScheduledMessageSchema.safeParse({
      channelIdentifier: "general",
      text: "hello",
      sendAt: 1784620000000,
    });
    expect(res.success).toBe(true);
  });

  it("accepts valid input with userIdentifier for DM", () => {
    const res = createScheduledMessageSchema.safeParse({
      userIdentifier: "sam@example.com",
      text: "hello",
      sendAt: 1784620000000,
    });
    expect(res.success).toBe(true);
  });
});

describe("createScheduledMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("resolves channel name and calls API successfully", async () => {
    const futureSendAt = Date.now() + 100000;
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "general" } }]) });
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true, message: { id: "sched1" } }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = createScheduledMessageSchema.parse({
      channelIdentifier: "general",
      text: "hello",
      sendAt: futureSendAt,
    });
    const result = await createScheduledMessage(input);

    expect(result).toMatchObject({
      ok: true,
      scheduled: true,
      scheduledMessageId: "sched1",
      channelId: "chan1",
      sendAt: futureSendAt,
      text: "hello",
      status: expect.stringContaining("Verification complete"),
    });
    
    const apiCall = fetchMock.mock.calls.find((c: any) => c[0].toString().includes("createScheduledMessage"));
    const body = JSON.parse(apiCall[1].body);
    expect(body.channelId).toBe("chan1");
    expect(body.text).toBe("hello");
    expect(body.sendAt).toBe(futureSendAt);
  });

  it("resolves userIdentifier if provided", async () => {
    const futureSendAt = Date.now() + 100000;
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan-dm", channelType: "DIRECT" }, users: ["usr1"] }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ id: "usr1", email: "sam@example.com" }]) });
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = createScheduledMessageSchema.parse({
      userIdentifier: "sam@example.com",
      text: "hello",
      sendAt: futureSendAt,
    });
    await createScheduledMessage(input);

    const apiCall = fetchMock.mock.calls.find((c: any) => c[0].toString().includes("createScheduledMessage"));
    const body = JSON.parse(apiCall[1].body);
    expect(body.channelId).toBe("chan-dm");
  });

  it("throws if channel not found", async () => {
    const futureSendAt = Date.now() + 100000;
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan1", name: "general" } }]) });
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = createScheduledMessageSchema.parse({
      channelIdentifier: "nonexistent",
      text: "hello",
      sendAt: futureSendAt,
    });
    await expect(createScheduledMessage(input)).rejects.toThrow(/Channel with name 'nonexistent' could not be found/);
  });

  it("throws clear error when sendAt is in the past", async () => {
    const input = createScheduledMessageSchema.parse({
      channelIdentifier: "general",
      text: "hello",
      sendAt: Date.now() - 10000, // 10s in past
    });
    await expect(createScheduledMessage(input)).rejects.toThrow(/sendAt must be a timestamp at least 30 seconds in the future/);
  });

  it("throws canonical error when no DM conversation exists with user", async () => {
    const futureSendAt = Date.now() + 100000;
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ id: "u_new", email: "newuser@example.com" }]) });
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = createScheduledMessageSchema.parse({
      userIdentifier: "newuser@example.com",
      text: "hello",
      sendAt: futureSendAt,
    });
    await expect(createScheduledMessage(input)).rejects.toThrow(
      /Cannot schedule DM to user 'newuser@example.com': No direct conversation exists with this user yet/
    );
  });
});
