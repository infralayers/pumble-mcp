import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMessage, getMessageSchema } from "../../src/tools/getMessage.js";
import { clearCache } from "../../src/tools/resolve.js";

describe("getMessageSchema", () => {
  it("rejects when messageId is missing", () => {
    expect(getMessageSchema.safeParse({ channelIdentifier: "c_test_channel" }).success).toBe(false);
  });

  it("rejects when channelIdentifier is missing", () => {
    expect(getMessageSchema.safeParse({ messageId: "m_test_1" }).success).toBe(false);
  });

  it("accepts valid input", () => {
    expect(
      getMessageSchema.safeParse({
        messageId: "m_test_1",
        channelIdentifier: "c_test_channel",
      }).success
    ).toBe(true);
  });
});

describe("getMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
    clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("resolves channel name, queries fetchMessage, and returns projected message", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listChannels")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify([{ channel: { id: "chan_1", name: "test-channel" } }]),
        });
      }
      if (u.includes("/listUsers")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify([{ id: "usr_alpha", name: "UserAlpha" }]),
        });
      }
      if (u.includes("/fetchMessage")) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              id: "m_test_1",
              channelId: "chan_1",
              author: "usr_alpha",
              text: "Hello from test",
              timestamp: "2026-10-27T10:00:00Z",
              edited: true,
              reactions: [{ user: "usr_beta", code: ":thumbsup:" }],
              files: [{ id: "f1", name: "document.pdf", size: 1024, mimeType: "application/pdf" }],
              blocks: [{ type: "rich_text" }],
            }),
        });
      }
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = getMessageSchema.parse({
      messageId: "m_test_1",
      channelIdentifier: "test-channel",
    });
    const result = await getMessage(input);

    expect(result).toEqual({
      id: "m_test_1",
      channelId: "chan_1",
      author: "UserAlpha",
      text: "Hello from test",
      timestamp: "2026-10-27T10:00:00Z",
      edited: true,
      reactions: [":thumbsup:"],
      files: ["document.pdf"],
    });

    const fetchCall = fetchMock.mock.calls.find(([u]) => u.toString().includes("/fetchMessage"));
    expect(fetchCall).toBeDefined();
    expect(fetchCall![0].toString()).toContain("messageId=m_test_1");
    expect(fetchCall![0].toString()).toContain("channelId=chan_1");
  });
});
