import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editScheduledMessageSchema, editScheduledMessage } from "../../src/tools/editScheduledMessage.js";

describe("editScheduledMessageSchema", () => {
  it("validates valid edit input", () => {
    const res = editScheduledMessageSchema.safeParse({
      scheduledMessageId: "6a5f4bbce0addeac89ba9d1d",
      text: "Updated scheduled text",
    });
    expect(res.success).toBe(true);
  });

  it("validates edit input with sendAt", () => {
    const res = editScheduledMessageSchema.safeParse({
      scheduledMessageId: "6a5f4bbce0addeac89ba9d1d",
      sendAt: "2026-07-21T20:00:00Z",
    });
    expect(res.success).toBe(true);
  });

  it("fails when scheduledMessageId is missing", () => {
    const res = editScheduledMessageSchema.safeParse({
      text: "No ID",
    });
    expect(res.success).toBe(false);
  });

  it("fails when multiple targets are provided", () => {
    const res = editScheduledMessageSchema.safeParse({
      scheduledMessageId: "6a5f4bbce0addeac89ba9d1d",
      channelIdentifier: "general",
      userIdentifier: "123",
    });
    expect(res.success).toBe(false);
  });
});

describe("editScheduledMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("resolves channel name, fetches existing message, merges, and calls POST /editScheduledMessage", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/fetchScheduledMessage")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              id: "sch123",
              channelIdentifier: "chan-old",
              text: "Old text",
              sendAt: 1784620000000,
            }),
        };
      }
      if (urlStr.includes("/listChannels")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify([{ channel: { id: "chan-general", name: "general", channelType: "PUBLIC" } }]),
        };
      }
      if (urlStr.includes("/editScheduledMessage")) {
        return {
          ok: true,
          text: async () => JSON.stringify({ ok: true }),
        };
      }
      return { ok: false, text: async () => "Not found" };
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = editScheduledMessageSchema.parse({
      scheduledMessageId: "sch123",
      channelIdentifier: "general", // changing channel only
    });
    const result = await editScheduledMessage(input);

    expect(result).toEqual({ ok: true });

    const editCall = fetchMock.mock.calls.find((call) =>
      call[0].toString().includes("/editScheduledMessage")
    );
    expect(editCall).toBeDefined();
    expect(JSON.parse(editCall![1].body)).toEqual({
      scheduledMessageId: "sch123",
      channelId: "chan-general", // resolved/updated
      text: "Old text", // merged from existing
      sendAt: 1784620000000, // merged from existing
    });
  });
});

