import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listScheduledMessagesSchema, listScheduledMessages } from "../../src/tools/listScheduledMessages.js";
import { callTo, mockPumble } from "../helpers/mockPumble.js";

describe("listScheduledMessagesSchema", () => {
  it.each([
    ["channel + channelId", { channel: "general", channelId: "123" }],
    ["channel + userId", { channel: "general", userId: "507f1f77bcf86cd799439011" }],
    ["userId + email", { userId: "507f1f77bcf86cd799439011", email: "a@b.com" }],
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
      "/listUsers": [{ id: "user-sam", name: "Sam", email: "sam@example.com" }],
      "/listChannels": [
        { channel: { id: "chan-self", channelType: "SELF" }, users: ["user-current"] },
        { channel: { id: "chan-dm-sam", channelType: "DIRECT" }, users: ["user-sam", "user-current"] },
      ],
      "/fetchScheduledMessages": { scheduledMessages: [{ id: "sch2" }] },
    });

    await listScheduledMessages({ email: "sam@example.com" });

    expect(callTo(fetchMock, "/fetchScheduledMessages").url).toContain("channelId=chan-dm-sam");
  });

  it("passes cursor and limit through to the query string", async () => {
    const fetchMock = mockPumble({ "/fetchScheduledMessages": { scheduledMessages: [] } });

    await listScheduledMessages({ cursor: "page-token-123", limit: 5 });

    const { url } = callTo(fetchMock, "/fetchScheduledMessages");
    expect(url).toContain("cursor=page-token-123");
    expect(url).toContain("limit=5");
  });
});
