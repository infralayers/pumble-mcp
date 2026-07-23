import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getScheduledMessageSchema, getScheduledMessage } from "../../src/tools/getScheduledMessage.js";

describe("getScheduledMessageSchema", () => {
  it("validates when scheduledMessageId is present", () => {
    const res = getScheduledMessageSchema.safeParse({
      scheduledMessageId: "6a5f4bbce0addeac89ba9d1d",
    });
    expect(res.success).toBe(true);
  });

  it("fails when scheduledMessageId is missing", () => {
    const res = getScheduledMessageSchema.safeParse({});
    expect(res.success).toBe(false);
  });
});

describe("getScheduledMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls GET /fetchScheduledMessage with the correct query param", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "sch123", text: "hello" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getScheduledMessage({ scheduledMessageId: "sch123" });
    expect(result).toEqual({ id: "sch123", text: "hello" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://pumble-api-keys.addons.marketplace.cake.com/fetchScheduledMessage?scheduledMessageId=sch123"
    );
    expect(options.method).toBe("GET");
  });
});
