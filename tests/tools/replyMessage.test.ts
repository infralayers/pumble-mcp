import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { replyMessage, replyMessageSchema } from "../../src/tools/replyMessage.js";

describe("replyMessageSchema", () => {
  it("accepts valid input and defaults asBot to false", () => {
    const result = replyMessageSchema.parse({ messageId: "msg1", channelId: "abc", text: "hi" });
    expect(result.asBot).toBe(false);
  });
});

describe("replyMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls POST /sendReply with the parsed input", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "reply1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = replyMessageSchema.parse({ messageId: "msg1", channelId: "abc", text: "hello" });
    const result = await replyMessage(input);

    expect(result).toEqual({ id: "reply1" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/sendReply");
    expect(JSON.parse(options.body)).toEqual({ messageId: "msg1", channelId: "abc", text: "hello", asBot: false });
  });
});
