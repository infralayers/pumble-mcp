import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearListUsersCache, listUsers } from "../../src/tools/listUsers.js";

describe("listUsers", () => {
  beforeEach(() => {
    clearListUsersCache();
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    clearListUsersCache();
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls GET /listUsers with no params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ id: "507f1f77bcf86cd799439021", name: "Jane" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listUsers({});

    expect(result).toEqual([
      {
        id: "507f1f77bcf86cd799439021",
        name: "Jane",
        realName: undefined,
        email: undefined,
        status: undefined,
      },
    ]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/listUsers");
    expect(options.method).toBe("GET");
  });

  it("serves from memory cache on subsequent calls within 60 seconds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ id: "507f1f77bcf86cd799439021", name: "Jane" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listUsers({});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Call 2: Within 60 seconds -> serves from memory cache, 0 network calls!
    const cachedResult = await listUsers({});
    expect(cachedResult).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
