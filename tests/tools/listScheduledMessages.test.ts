import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listScheduledMessages, listScheduledMessagesSchema } from "../../src/tools/listScheduledMessages.js";

describe("listScheduledMessagesSchema", () => {
  it("accepts empty input", () => {
    const res = listScheduledMessagesSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it("accepts channelIdentifier", () => {
    const res = listScheduledMessagesSchema.safeParse({ channelIdentifier: "general" });
    expect(res.success).toBe(true);
  });

  it("accepts userIdentifier", () => {
    const res = listScheduledMessagesSchema.safeParse({ userIdentifier: "sam" });
    expect(res.success).toBe(true);
  });

  it("rejects when both channelIdentifier and userIdentifier are provided", () => {
    const res = listScheduledMessagesSchema.safeParse({ channelIdentifier: "general", userIdentifier: "sam" });
    expect(res.success).toBe(false);
  });
});

describe("listScheduledMessages", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("fetches list without params", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ messages: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = listScheduledMessagesSchema.parse({});
    const result = await listScheduledMessages(input);
    expect(result).toEqual({ messages: [] });
  });

  it("fetches list with channelIdentifier", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "c1", name: "general" } }]) });
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ messages: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = listScheduledMessagesSchema.parse({ channelIdentifier: "general" });
    await listScheduledMessages(input);

    const apiCall = fetchMock.mock.calls.find((c: any) => c[0].toString().includes("fetchScheduledMessages"));
    expect(apiCall[0].toString()).toContain("channelId=c1");
  });

  it("fetches list with userIdentifier", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "chan-dm", channelType: "DIRECT" }, users: ["u1"] }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ id: "u1", name: "sam" }]) });
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ messages: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = listScheduledMessagesSchema.parse({ userIdentifier: "sam" });
    await listScheduledMessages(input);

    const apiCall = fetchMock.mock.calls.find((c: any) => c[0].toString().includes("fetchScheduledMessages"));
    expect(apiCall[0].toString()).toContain("channelId=chan-dm");
  });
});
