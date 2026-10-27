import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMessage, deleteMessageSchema } from "../../src/tools/deleteMessage.js";
import { clearCache } from "../../src/tools/resolve.js";

describe("deleteMessageSchema", () => {
  it("rejects when confirm is missing or false", () => {
    expect(
      deleteMessageSchema.safeParse({
        messageId: "m_test_1",
        channelIdentifier: "c_test_channel",
      }).success
    ).toBe(false);

    expect(
      deleteMessageSchema.safeParse({
        messageId: "m_test_1",
        channelIdentifier: "c_test_channel",
        confirm: false,
      }).success
    ).toBe(false);
  });

  it("rejects when messageId or channelIdentifier is missing", () => {
    expect(
      deleteMessageSchema.safeParse({
        channelIdentifier: "c_test_channel",
        confirm: true,
      }).success
    ).toBe(false);

    expect(
      deleteMessageSchema.safeParse({
        messageId: "m_test_1",
        confirm: true,
      }).success
    ).toBe(false);
  });

  it("accepts valid input with confirm: true", () => {
    expect(
      deleteMessageSchema.safeParse({
        messageId: "m_test_1",
        channelIdentifier: "c_test_channel",
        confirm: true,
      }).success
    ).toBe(true);
  });
});

describe("deleteMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
    clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("resolves channel name and executes DELETE request", async () => {
    const fetchMock = vi.fn().mockImplementation((url, opts) => {
      const u = url.toString();
      if (u.includes("/listChannels")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify([{ channel: { id: "chan_1", name: "test-channel" } }]),
        });
      }
      if (u.includes("/deleteMessage")) {
        expect(opts?.method).toBe("DELETE");
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = deleteMessageSchema.parse({
      messageId: "m_test_1",
      channelIdentifier: "test-channel",
      confirm: true,
    });
    const result = await deleteMessage(input);

    expect(result).toEqual({
      ok: true,
      deleted: true,
      messageId: "m_test_1",
      channel: "test-channel",
      channelId: "chan_1",
      status: "Message successfully deleted. Verification complete — no further action needed.",
    });

    const deleteCall = fetchMock.mock.calls.find(([u]) => u.toString().includes("/deleteMessage"));
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0].toString()).toContain("messageId=m_test_1");
    expect(deleteCall![0].toString()).toContain("channelId=chan_1");
  });
});
