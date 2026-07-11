import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listChannels } from "../../src/tools/listChannels.js";

describe("listChannels", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls GET /listChannels with no params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ channel: { id: "1", name: "general" } }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listChannels({});

    expect(result).toEqual([{ channel: { id: "1", name: "general" } }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/listChannels");
    expect(options.method).toBe("GET");
  });
});
