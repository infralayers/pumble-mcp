import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMessages, listMessagesSchema } from "../../src/tools/listMessages.js";

describe("listMessagesSchema", () => {
  it("rejects when neither channel nor channelId is given", () => {
    expect(listMessagesSchema.safeParse({}).success).toBe(false);
  });

  it("rejects when both channel and channelId are given", () => {
    expect(
      listMessagesSchema.safeParse({ channel: "general", channelId: "abc" }).success,
    ).toBe(false);
  });
});

describe("listMessages", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
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

    const input = listMessagesSchema.parse({ channelId: "abc", limit: 5, cursor: "c1" });
    const result = await listMessages(input);

    expect(result.messages).toEqual([{ id: "m1" }]);
    const [url] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://pumble-api-keys.addons.marketplace.cake.com/listMessages?channelId=abc&cursor=c1&limit=5",
    );
  });

  it("omits cursor/limit from the query string when not given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ hasMoreAfter: false, hasMoreBefore: false, messages: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = listMessagesSchema.parse({ channel: "general" });
    await listMessages(input);

    const [url] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://pumble-api-keys.addons.marketplace.cake.com/listMessages?channel=general",
    );
  });
});
