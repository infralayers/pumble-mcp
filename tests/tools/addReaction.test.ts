import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addReaction } from "../../src/tools/addReaction.js";

describe("addReaction", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls POST /addReaction with the right body shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{"success":true}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await addReaction({ messageId: "m1", channelIdentifier: "c1", reaction: ":thumbsup:" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/addReaction");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ messageId: "m1", channelId: "c1", reaction: ":thumbsup:" });
  });

  it("surfaces the error field verbatim on a 403 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '{"error":"Invalid request parameters"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      addReaction({ messageId: "m1", channelIdentifier: "c1", reaction: ":thumbsup:" }),
    ).rejects.toThrow(/Invalid request parameters/);
  });
});
