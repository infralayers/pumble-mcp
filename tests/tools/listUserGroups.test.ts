import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listUserGroups } from "../../src/tools/listUserGroups.js";

describe("listUserGroups", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls GET /listUserGroups with no params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          {
            id: "g1",
            name: "Engineering",
            handle: "engineering",
            description: "Dev team",
            workspaceUserIds: ["u1", "u2"],
          },
        ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listUserGroups({});

    expect(result).toEqual([
      {
        id: "g1",
        name: "Engineering",
        handle: "engineering",
        description: "Dev team",
        workspaceUserIds: ["u1", "u2"],
      },
    ]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/listUserGroups");
    expect(options.method).toBe("GET");
  });
});
