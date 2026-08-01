import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduledMessageSchema, createScheduledMessage } from "../../src/tools/createScheduledMessage.js";
import { callTo, mockPumble, neverCalled } from "../helpers/mockPumble.js";

const BASE = { text: "Test scheduler", sendAt: 1784620000000 };

describe("createScheduledMessageSchema", () => {
  it.each([
    ["no target", {}],
    ["two targets", { channel: "general", userId: "668e30546a5ea56c5d83f46b" }],
  ])("requires exactly one destination: %s", (_label, target) => {
    expect(createScheduledMessageSchema.safeParse({ ...BASE, ...target }).success).toBe(false);
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

  it("resolves a channel name and posts the scheduled message", async () => {
    const fetchMock = mockPumble({
      "/listChannels": [{ channel: { id: "chan-general", name: "general", channelType: "PUBLIC" } }],
      "/createScheduledMessage": { id: "sch123", channelId: "chan-general" },
    });

    const input = createScheduledMessageSchema.parse({ ...BASE, channel: "general" });
    const result = await createScheduledMessage(input);

    expect(result).toEqual({ id: "sch123", channelId: "chan-general" });
    expect(callTo(fetchMock, "/createScheduledMessage").body).toEqual({
      ...BASE,
      channelId: "chan-general",
    });
  });

  it("throws instead of guessing when a channel name matches multiple channels", async () => {
    const fetchMock = mockPumble({
      "/listChannels": [
        { channel: { id: "chan-a", name: "general", channelType: "PUBLIC" } },
        { channel: { id: "chan-b", name: "General", channelType: "PRIVATE" } },
      ],
    });

    const input = createScheduledMessageSchema.parse({ ...BASE, channel: "general" });

    await expect(createScheduledMessage(input)).rejects.toThrow(/matches multiple channels/);
    expect(neverCalled(fetchMock, "/createScheduledMessage")).toBe(true);
  });
});
