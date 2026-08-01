import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listScheduledMessagesSchema, listScheduledMessages } from "../../src/tools/listScheduledMessages.js";
import { callTo, mockPumble } from "../helpers/mockPumble.js";

describe("listScheduledMessagesSchema", () => {
  it.each([
    ["channel + channelId", { channel: "general", channelId: "123" }],
    ["channel + userId", { channel: "general", userId: "668e30546a5ea56c5d83f46b" }],
    ["userId + email", { userId: "668e30546a5ea56c5d83f46b", email: "a@b.com" }],
  ])("rejects more than one filter: %s", (_label, input) => {
    expect(listScheduledMessagesSchema.safeParse(input).success).toBe(false);
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

  it("resolves a channel name to its ID before querying", async () => {
    const fetchMock = mockPumble({
      "/listChannels": [{ channel: { id: "chan-general", name: "general", channelType: "PUBLIC" } }],
      "/fetchScheduledMessages": { scheduledMessages: [{ id: "sch1" }] },
    });

    const result = await listScheduledMessages({ channel: "general" });

    expect(result).toEqual({ scheduledMessages: [{ id: "sch1" }] });
    expect(callTo(fetchMock, "/fetchScheduledMessages").url).toContain("channelId=chan-general");
  });

  it("resolves an email to that user's DM channel", async () => {
    const fetchMock = mockPumble({
      "/listUsers": [{ id: "user-nouman", name: "Nouman", email: "nouman@proton.me" }],
      "/listChannels": [
        { channel: { id: "chan-self", channelType: "SELF" }, users: ["user-current"] },
        { channel: { id: "chan-dm-nouman", channelType: "DIRECT" }, users: ["user-nouman", "user-current"] },
      ],
      "/fetchScheduledMessages": { scheduledMessages: [{ id: "sch2" }] },
    });

    await listScheduledMessages({ email: "nouman@proton.me" });

    expect(callTo(fetchMock, "/fetchScheduledMessages").url).toContain("channelId=chan-dm-nouman");
  });

  it("passes cursor and limit through to the query string", async () => {
    const fetchMock = mockPumble({ "/fetchScheduledMessages": { scheduledMessages: [] } });

    await listScheduledMessages({ cursor: "page-token-123", limit: 5 });

    const { url } = callTo(fetchMock, "/fetchScheduledMessages");
    expect(url).toContain("cursor=page-token-123");
    expect(url).toContain("limit=5");
  });
});
