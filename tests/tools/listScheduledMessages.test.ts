import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listScheduledMessagesSchema, listScheduledMessages } from "../../src/tools/listScheduledMessages.js";

describe("listScheduledMessagesSchema", () => {
  it("validates empty input", () => {
    const res = listScheduledMessagesSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it("validates channelId filter", () => {
    const res = listScheduledMessagesSchema.safeParse({ channelIdentifier: "123456789012345678901234" });
    expect(res.success).toBe(true);
  });

  it("validates channel filter", () => {
    const res = listScheduledMessagesSchema.safeParse({ channelIdentifier: "general" });
    expect(res.success).toBe(true);
  });

  it("fails if both channel and channelId are provided", () => {
    const res = listScheduledMessagesSchema.safeParse({ channelIdentifier: "general", channelIdentifier: "123" });
    expect(res.success).toBe(false);
  });

  it("validates userId filter", () => {
    const res = listScheduledMessagesSchema.safeParse({ userIdentifier: "668e30546a5ea56c5d83f46b" });
    expect(res.success).toBe(true);
  });

  it("validates email filter", () => {
    const res = listScheduledMessagesSchema.safeParse({ email: "nouman-tariq-1414@proton.me" });
    expect(res.success).toBe(true);
  });

  it("fails if multiple filters are provided", () => {
    const res = listScheduledMessagesSchema.safeParse({
      channelIdentifier: "general",
      userIdentifier: "668e30546a5ea56c5d83f46b",
    });
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

  it("fetches scheduled messages with resolved channel ID from channel name", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/listChannels")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([{ channel: { id: "chan-general", name: "general", channelType: "PUBLIC" } }]),
        };
      }
      if (urlStr.includes("/fetchScheduledMessages")) {
        return {
          ok: true,
          text: async () => JSON.stringify({ scheduledMessages: [{ id: "sch1" }] }),
        };
      }
      return { ok: false, text: async () => "Not found" };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listScheduledMessages({ channelIdentifier: "general" });
    expect(result).toEqual({ scheduledMessages: [{ id: "sch1" }] });
    
    // Find the call for fetchScheduledMessages
    const scheduledCall = fetchMock.mock.calls.find((call) =>
      call[0].toString().includes("/fetchScheduledMessages")
    );
    expect(scheduledCall).toBeDefined();
    expect(scheduledCall![0].toString()).toContain("channelId=chan-general");
  });

  it("fetches scheduled messages with resolved channel ID from user email", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/listUsers")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              { id: "user-nouman", name: "Nouman", email: "nouman@proton.me" },
            ]),
        };
      }
      if (urlStr.includes("/listChannels")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                channel: { id: "chan-self", name: "", channelType: "SELF" },
                users: ["user-current"],
              },
              {
                channel: { id: "chan-dm-nouman", name: "", channelType: "DIRECT" },
                users: ["user-nouman", "user-current"],
              },
            ]),
        };
      }
      if (urlStr.includes("/fetchScheduledMessages")) {
        return {
          ok: true,
          text: async () => JSON.stringify({ scheduledMessages: [{ id: "sch2" }] }),
        };
      }
      return { ok: false, text: async () => "Not found" };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listScheduledMessages({ email: "nouman@proton.me" });
    expect(result).toEqual({ scheduledMessages: [{ id: "sch2" }] });

    const scheduledCall = fetchMock.mock.calls.find((call) =>
      call[0].toString().includes("/fetchScheduledMessages")
    );
    expect(scheduledCall).toBeDefined();
    expect(scheduledCall![0].toString()).toContain("channelId=chan-dm-nouman");
  });

  it("passes cursor parameter through to query string", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      return {
        ok: true,
        text: async () => JSON.stringify({ scheduledMessages: [] }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await listScheduledMessages({ cursor: "page-token-123", limit: 5 });

    const scheduledCall = fetchMock.mock.calls.find((call) =>
      call[0].toString().includes("/fetchScheduledMessages")
    );
    expect(scheduledCall).toBeDefined();
    expect(scheduledCall![0].toString()).toContain("cursor=page-token-123");
    expect(scheduledCall![0].toString()).toContain("limit=5");
  });
});


