import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editMessage } from "../../src/tools/editMessage.js";

describe("editMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls POST /editMessage with the right body shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await editMessage({ messageId: "m1", channelIdentifier: "507f1f77bcf86cd799439011", text: "updated" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/editMessage");
    expect(JSON.parse(options.body)).toEqual({ messageId: "m1", channelId: "507f1f77bcf86cd799439011", text: "updated" });
  });

  it("surfaces the error field verbatim on a 403 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '{"error":"Invalid request parameters"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      editMessage({ messageId: "m1", channelIdentifier: "507f1f77bcf86cd799439011", text: "updated" }),
    ).rejects.toThrow(/Invalid request parameters/);
  });
});
