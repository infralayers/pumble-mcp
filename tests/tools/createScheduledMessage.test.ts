import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduledMessageSchema, createScheduledMessage } from "../../src/tools/createScheduledMessage.js";

describe("createScheduledMessageSchema", () => {
  it("validates valid input with channelId and epoch timestamp", () => {
    const res = createScheduledMessageSchema.safeParse({
      channelId: "6a5a28d83130c76707112bc8",
      text: "Hello future",
      sendAt: 1784620000000,
    });
    expect(res.success).toBe(true);
  });

  it("validates valid input with channel name and ISO date string", () => {
    const res = createScheduledMessageSchema.safeParse({
      channel: "general",
      text: "Hello future ISO",
      sendAt: "2026-07-21T18:00:00Z",
    });
    expect(res.success).toBe(true);
  });

  it("validates valid input with userId", () => {
    const res = createScheduledMessageSchema.safeParse({
      userId: "668e30546a5ea56c5d83f46b",
      text: "Hello user",
      sendAt: 1784620000000,
    });
    expect(res.success).toBe(true);
  });

  it("validates valid input with email", () => {
    const res = createScheduledMessageSchema.safeParse({
      email: "nouman@proton.me",
      text: "Hello email",
      sendAt: 1784620000000,
    });
    expect(res.success).toBe(true);
  });

  it("fails when missing destination targets", () => {
    const res = createScheduledMessageSchema.safeParse({
      text: "No destination",
      sendAt: 1784620000000,
    });
    expect(res.success).toBe(false);
  });

  it("fails when providing multiple destination targets", () => {
    const res = createScheduledMessageSchema.safeParse({
      channel: "general",
      channelId: "6a5a28d83130c76707112bc8",
      text: "Multiple targets",
      sendAt: 1784620000000,
    });
    expect(res.success).toBe(false);
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

  it("resolves channel name and calls POST /createScheduledMessage", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/getChannel")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              channel: { id: "chan-general", name: "general", channelType: "PUBLIC" },
            }),
        };
      }
      if (urlStr.includes("/createScheduledMessage")) {
        return {
          ok: true,
          text: async () => JSON.stringify({ id: "sch123", channelId: "chan-general" }),
        };
      }
      return { ok: false, text: async () => "Not found" };
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = createScheduledMessageSchema.parse({
      channel: "general",
      text: "Test scheduler",
      sendAt: 1784620000000,
    });
    const result = await createScheduledMessage(input);

    expect(result).toEqual({ id: "sch123", channelId: "chan-general" });

    const createCall = fetchMock.mock.calls.find((call) =>
      call[0].toString().includes("/createScheduledMessage")
    );
    expect(createCall).toBeDefined();
    expect(JSON.parse(createCall![1].body)).toEqual({
      text: "Test scheduler",
      sendAt: 1784620000000,
      channelId: "chan-general",
    });
  });
});

