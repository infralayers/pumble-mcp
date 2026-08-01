import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { replyMessage, replyMessageSchema } from "../../src/tools/replyMessage.js";

const CHANNEL_ID = "507f1f77bcf86cd799439011";
const ENDPOINT = "https://pumble-api-keys.addons.marketplace.cake.com/sendReply";

const CHANNELS = [
  { channel: { id: CHANNEL_ID, name: "general" } },
  { channel: { id: "507f1f77bcf86cd799439012", name: "random" } },
];

/** Stubs fetch to return each body in turn. An unstubbed extra call fails loudly. */
function stubFetch(...bodies: unknown[]) {
  const fetchMock = vi.fn((): Promise<unknown> => {
    throw new Error("fetch called more times than stubFetch has responses");
  });
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify(body) });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const parse = (overrides: Record<string, unknown> = {}) =>
  replyMessageSchema.parse({ messageId: "msg1", channelIdentifier: CHANNEL_ID, text: "hello", ...overrides });

const sentBody = (fetchMock: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse(fetchMock.mock.calls[call][1].body);

describe("replyMessageSchema", () => {
  it("accepts valid input and defaults asBot to false", () => {
    expect(parse().asBot).toBe(false);
  });

  it("rejects empty text", () => {
    expect(
      replyMessageSchema.safeParse({ messageId: "msg1", channelIdentifier: CHANNEL_ID, text: "" }).success,
    ).toBe(false);
  });

  it("rejects a missing channelIdentifier", () => {
    expect(replyMessageSchema.safeParse({ messageId: "msg1", text: "hi" }).success).toBe(false);
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

  it("posts to /sendReply with the resolved channelId", async () => {
    const fetchMock = stubFetch({ id: "reply1" });

    const result = await replyMessage(parse());

    expect(result).toEqual({ id: "reply1" });
    // An ID-shaped identifier short-circuits resolution, so /sendReply is the only call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toBe(ENDPOINT);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(sentBody(fetchMock)).toEqual({
      messageId: "msg1",
      channelId: CHANNEL_ID,
      text: "hello",
      asBot: false,
    });
  });

  it("forwards asBot when set to true", async () => {
    const fetchMock = stubFetch({ id: "reply1" });

    await replyMessage(parse({ asBot: true }));

    expect(sentBody(fetchMock).asBot).toBe(true);
  });

  it("resolves a channel name to an ID before replying", async () => {
    const fetchMock = stubFetch(CHANNELS, { id: "reply1" });

    await replyMessage(parse({ channelIdentifier: "general" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 1).channelId).toBe(CHANNEL_ID);
  });

  it("throws when the channel name matches nothing", async () => {
    const fetchMock = stubFetch(CHANNELS);

    await expect(replyMessage(parse({ channelIdentifier: "nope" }))).rejects.toThrow(/could not be found/);
    // Resolution failed, so no reply was ever sent.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the API rejects the reply", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "Bad Request" }));

    await expect(replyMessage(parse())).rejects.toThrow(/sendReply failed \(400\)/);
  });
});
