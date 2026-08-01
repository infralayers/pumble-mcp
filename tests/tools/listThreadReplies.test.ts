import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listThreadReplies, listThreadRepliesSchema } from "../../src/tools/listThreadReplies.js";

const CHANNEL_ID = "507f1f77bcf86cd799439011";
const ENDPOINT = "https://pumble-api-keys.addons.marketplace.cake.com/fetchThreadReplies";

const CHANNELS = [
  { channel: { id: CHANNEL_ID, name: "general" } },
  { channel: { id: "507f1f77bcf86cd799439012", name: "random" } },
];
const DUPLICATE_NAMES = [
  { channel: { id: CHANNEL_ID, name: "general" } },
  { channel: { id: "507f1f77bcf86cd799439012", name: "general" } },
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
  listThreadRepliesSchema.parse({ messageId: "msg1", channelIdentifier: CHANNEL_ID, ...overrides });

const urlOf = (fetchMock: ReturnType<typeof vi.fn>, call = 0) =>
  fetchMock.mock.calls[call][0].toString();

describe("listThreadRepliesSchema", () => {
  it("accepts valid input", () => {
    expect(listThreadRepliesSchema.safeParse({ messageId: "msg1", channelIdentifier: CHANNEL_ID }).success).toBe(true);
  });

  it("rejects a missing channelIdentifier", () => {
    expect(listThreadRepliesSchema.safeParse({ messageId: "msg1" }).success).toBe(false);
  });

  it("rejects a non-positive limit", () => {
    expect(
      listThreadRepliesSchema.safeParse({ messageId: "msg1", channelIdentifier: CHANNEL_ID, limit: 0 }).success,
    ).toBe(false);
  });
});

describe("listThreadReplies", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("builds the query string including optional cursor/limit", async () => {
    const fetchMock = stubFetch([{ id: "r1" }]);

    const result = await listThreadReplies(parse({ cursor: "c1", limit: 50 }));

    expect(result).toEqual([{ id: "r1" }]);
    expect(urlOf(fetchMock)).toBe(`${ENDPOINT}?rootMessageId=msg1&channelId=${CHANNEL_ID}&cursor=c1&limit=50`);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("omits cursor/limit from the query string when not given", async () => {
    const fetchMock = stubFetch([]);

    await listThreadReplies(parse());

    expect(urlOf(fetchMock)).toBe(`${ENDPOINT}?rootMessageId=msg1&channelId=${CHANNEL_ID}`);
  });

  it("resolves a channel name to an ID before fetching", async () => {
    const fetchMock = stubFetch(CHANNELS, []);

    await listThreadReplies(parse({ channelIdentifier: "general" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(fetchMock, 1)).toContain(`channelId=${CHANNEL_ID}`);
  });

  it("throws when the channel name is ambiguous rather than guessing", async () => {
    const fetchMock = stubFetch(DUPLICATE_NAMES);

    await expect(listThreadReplies(parse({ channelIdentifier: "general" }))).rejects.toThrow(/matches multiple channels/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the API returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "Not Found" }));

    await expect(listThreadReplies(parse())).rejects.toThrow(/fetchThreadReplies failed \(404\)/);
  });
});
