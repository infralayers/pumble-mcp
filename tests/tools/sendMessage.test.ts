import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessage, sendMessageSchema } from "../../src/tools/sendMessage.js";

describe("sendMessageSchema", () => {
  it("rejects when neither channel nor channelId is given", () => {
    expect(sendMessageSchema.safeParse({ text: "hi" }).success).toBe(false);
  });

  it("rejects when both channel and channelId are given", () => {
    expect(
      sendMessageSchema.safeParse({ channel: "general", channelId: "abc", text: "hi" }).success,
    ).toBe(false);
  });

  it("accepts channelId alone and defaults asBot to false", () => {
    const result = sendMessageSchema.parse({ channelId: "abc", text: "hi" });
    expect(result.asBot).toBe(false);
  });
});

describe("sendMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls POST /sendMessage with the parsed input", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "msg1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = sendMessageSchema.parse({ channelId: "abc", text: "hello" });
    const result = await sendMessage(input);

    expect(result).toEqual({ id: "msg1" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/sendMessage");
    expect(JSON.parse(options.body)).toEqual({ channelId: "abc", text: "hello", asBot: false });
  });
});
