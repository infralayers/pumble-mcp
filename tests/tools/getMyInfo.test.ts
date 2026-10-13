import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMyInfo } from "../../src/tools/getMyInfo.js";

describe("getMyInfo", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls GET /myInfo with no params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "u1", name: "Jane" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMyInfo({});

    expect(result).toEqual({ id: "u1", name: "Jane" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/myInfo");
    expect(options.method).toBe("GET");
  });
});
