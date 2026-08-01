import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchMessages, searchMessagesSchema } from "../../src/tools/searchMessages.js";

describe("searchMessagesSchema", () => {
  it("rejects when no identifier or text is provided", () => {
    const res = searchMessagesSchema.safeParse({});
    expect(res.success).toBe(false);
  });

  it("accepts when text is provided", () => {
    const res = searchMessagesSchema.safeParse({ text: "hello" });
    expect(res.success).toBe(true);
  });

  it("accepts when fromUserIdentifiers is provided", () => {
    const res = searchMessagesSchema.safeParse({ fromUserIdentifiers: ["sam"] });
    expect(res.success).toBe(true);
  });

  it("accepts when inChannelIdentifiers is provided", () => {
    const res = searchMessagesSchema.safeParse({ inChannelIdentifiers: ["general"] });
    expect(res.success).toBe(true);
  });

  it("supports singular strings that are coerced to arrays by the backend logic", () => {
    const res = searchMessagesSchema.safeParse({ fromUserIdentifiers: ["sam"] });
    expect(res.success).toBe(true);
  });
});

describe("searchMessages", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("resolves names to IDs and calls the search API correctly", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ channel: { id: "c1", name: "general" } }]) });
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([{ id: "u1", name: "sam" }]) });
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ messages: [{ text: "found" }] }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({
      text: "search query",
      fromUserIdentifiers: ["sam"],
      inChannelIdentifiers: ["general"],
    });

    const result = await searchMessages(input);
    expect(result).toEqual({ messages: [{ text: "found" }] });

    const apiCall = fetchMock.mock.calls.find((c: any) => c[0].toString().includes("searchMessages"));
    const body = JSON.parse(apiCall[1].body);
    expect(body.text).toBe("search query");
    expect(body.from).toEqual(["u1"]);
    expect(body.in).toEqual(["c1"]);
  });

  it("passes raw IDs straight through without lookup if they match the ID pattern", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      // Should not call listUsers or listChannels because the IDs are raw
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ messages: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({
      fromUserIdentifiers: ["507f1f77bcf86cd799439011"],
      inChannelIdentifiers: ["668e30546a5ea56c5d83f471"],
    });

    await searchMessages(input);

    const apiCall = fetchMock.mock.calls.find((c: any) => c[0].toString().includes("searchMessages"));
    const body = JSON.parse(apiCall[1].body);
    expect(body.from).toEqual(["507f1f77bcf86cd799439011"]);
    expect(body.in).toEqual(["668e30546a5ea56c5d83f471"]);
    
    // Ensure no lookup calls were made
    const listUsersCalls = fetchMock.mock.calls.filter((c: any) => c[0].toString().includes("/listUsers"));
    expect(listUsersCalls.length).toBe(0);
  });

  it("throws when a user cannot be resolved", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listUsers")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([]) });
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({
      fromUserIdentifiers: ["ghost user"],
    });

    await expect(searchMessages(input)).rejects.toThrow(/User not found for 'ghost user'/);
  });

  it("throws when a channel cannot be resolved", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) return Promise.resolve({ ok: true, text: async () => JSON.stringify([]) });
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({
      inChannelIdentifiers: ["ghost channel"],
    });

    await expect(searchMessages(input)).rejects.toThrow(/Channel with name 'ghost channel' could not be found/);
  });

  it("passes date filters (after and before) to the backend", async () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ messages: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({
      text: "hello",
      after: "2026-01-01T00:00:00Z",
      before: "2026-08-01T00:00:00Z"
    });

    await searchMessages(input);

    const apiCall = fetchMock.mock.calls.find((c: any) => c[0].toString().includes("searchMessages"));
    const body = JSON.parse(apiCall[1].body);
    expect(body.after).toBe("2026-01-01T00:00:00Z");
    expect(body.before).toBe("2026-08-01T00:00:00Z");
  });
});
