import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMessages, listMessagesSchema } from "../../src/tools/listMessages.js";

import { clearCache } from "../../src/tools/resolve.js";

describe("listMessagesSchema", () => {
  it("rejects when both channelIdentifier and userIdentifier are missing", () => {
    expect(listMessagesSchema.safeParse({}).success).toBe(false);
  });

  it("rejects when both channelIdentifier and userIdentifier are provided", () => {
    expect(
      listMessagesSchema.safeParse({
        channelIdentifier: "507f1f77bcf86cd799439011",
        userIdentifier: "507f1f77bcf86cd799439012",
      }).success
    ).toBe(false);
  });

  it("accepts when only channelIdentifier is provided", () => {
    expect(
      listMessagesSchema.safeParse({
        channelIdentifier: "507f1f77bcf86cd799439011",
      }).success
    ).toBe(true);
  });

  it("accepts when only userIdentifier is provided", () => {
    expect(
      listMessagesSchema.safeParse({
        userIdentifier: "UserBeta",
      }).success
    ).toBe(true);
  });
});

describe("listMessages", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
    clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("builds the query string including optional cursor/limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ hasMoreAfter: false, hasMoreBefore: false, messages: [{ id: "m1" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = listMessagesSchema.parse({ channelIdentifier: "507f1f77bcf86cd799439011", limit: 5, cursor: "507f1f77bcf86cd799439011" });
    const result = await listMessages(input);

    expect(result.messages).toEqual([{ id: "m1" }]);
    const [url] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://pumble-api-keys.addons.marketplace.cake.com/listMessages?channelId=507f1f77bcf86cd799439011&cursor=507f1f77bcf86cd799439011&limit=5",
    );
  });

  it("applies default limit of 10 when limit is not given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ hasMoreAfter: false, hasMoreBefore: false, messages: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = listMessagesSchema.parse({ channelIdentifier: "507f1f77bcf86cd799439012" });
    await listMessages(input);

    const [url] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://pumble-api-keys.addons.marketplace.cake.com/listMessages?channelId=507f1f77bcf86cd799439012&limit=10",
    );
  });

  it("resolves user and lists direct messages when userIdentifier is given", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listUsers")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify([{ id: "u_beta", name: "UserBeta" }]),
        });
      }
      if (u.includes("/myInfo")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ id: "u_me", name: "My Bot" }),
        });
      }
      if (u.includes("/listChannels")) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify([
              { channel: { id: "c_dm_beta", channelType: "DIRECT" }, users: ["u_beta"] },
            ]),
        });
      }
      if (u.includes("/listMessages")) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              hasMoreAfter: false,
              hasMoreBefore: false,
              messages: [{ id: "m_dm_1", text: "Hello UserBeta" }],
            }),
        });
      }
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = listMessagesSchema.parse({ userIdentifier: "UserBeta" });
    const result = await listMessages(input);

    expect(result.messages).toEqual([{ id: "m_dm_1", text: "Hello UserBeta" }]);
    const listMessagesCall = fetchMock.mock.calls.find(([u]) => u.toString().includes("/listMessages"));
    expect(listMessagesCall).toBeDefined();
    expect(listMessagesCall![0].toString()).toContain("channelId=c_dm_beta");
  });

  it("caps messages to input.limit and projects high-density tokens", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/listUsers")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify([{ id: "usr_alpha", name: "UserAlpha" }]),
        });
      }
      if (u.includes("/listMessages")) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              hasMoreAfter: false,
              hasMoreBefore: true,
              messages: [
                { id: "m1", text: "old message 1", author: "usr_alpha" },
                { id: "m2", text: "old message 2", author: "usr_alpha" },
                {
                  id: "m3",
                  author: "usr_alpha",
                  text: "", // empty text with file
                  timestamp: "2026-08-27T10:06:11Z",
                  reactions: [
                    { user: "usr_beta", code: ":white_check_mark:" },
                    { user: "usr_gamma", code: ":white_check_mark:" }, // duplicate reaction code
                  ],
                  files: [
                    { id: "f1", name: "Screenshot.png", size: 37599, mimeType: "image/png" },
                  ],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    // Limit to 1 message (should return only the latest: m3)
    const input = listMessagesSchema.parse({
      channelIdentifier: "507f1f77bcf86cd799439011",
      limit: 1,
    });
    const result = await listMessages(input);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      id: "m3",
      author: "UserAlpha", // resolved from user cache/lookup
      timestamp: "2026-08-27T10:06:11Z",
      reactions: [":white_check_mark:"], // deduplicated string codes
      files: ["Screenshot.png"], // filename only
    });
    // Ensure empty text is omitted entirely
    expect((result.messages[0] as any).text).toBeUndefined();
  });
});
