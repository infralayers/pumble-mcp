import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listUsers } from "../../src/tools/listUsers.js";

describe("listUsers", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls GET /listUsers with no params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ id: "u1", name: "Jane" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listUsers({});

    expect(result).toEqual([{ id: "u1", name: "Jane" }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/listUsers");
    expect(options.method).toBe("GET");
  });
});
