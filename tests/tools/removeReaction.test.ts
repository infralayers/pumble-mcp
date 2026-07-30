import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { removeReaction } from "../../src/tools/removeReaction.js";

describe("removeReaction", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls DELETE /removeReaction with the right body shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{"success":true}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await removeReaction({ messageId: "m1", channelIdentifier: "c1", reaction: ":thumbsup:" });

    const [url, options] = fetchMock.mock.calls[0];
    const urlObj = new URL(url);
    expect(urlObj.origin + urlObj.pathname).toBe("https://pumble-api-keys.addons.marketplace.cake.com/removeReaction");
    expect(options.method).toBe("DELETE");
    expect(urlObj.searchParams.get("messageId")).toBe("m1");
    expect(urlObj.searchParams.get("channelId")).toBe("c1");
    expect(urlObj.searchParams.get("reaction")).toBe(":thumbsup:");
  });

  it("surfaces the error field verbatim on a 403 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '{"error":"Invalid request parameters"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      removeReaction({ messageId: "m1", channelIdentifier: "c1", reaction: ":thumbsup:" }),
    ).rejects.toThrow(/Invalid request parameters/);
  });
});
