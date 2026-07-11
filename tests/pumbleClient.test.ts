import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pumbleRequest } from "../src/pumbleClient.js";

describe("pumbleRequest", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("builds a GET request with query params and the ApiKey header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ id: "1" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await pumbleRequest("/listMessages", {
      method: "GET",
      query: { channelId: "abc", limit: 10, cursor: undefined },
    });

    expect(result).toEqual([{ id: "1" }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://pumble-api-keys.addons.marketplace.cake.com/listMessages?channelId=abc&limit=10",
    );
    expect(options.method).toBe("GET");
    expect(options.headers.ApiKey).toBe("test-key");
    expect(options.body).toBeUndefined();
  });

  it("builds a POST request with a JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "msg1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await pumbleRequest("/sendMessage", {
      method: "POST",
      body: { channelId: "abc", text: "hi" },
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/sendMessage");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ channelId: "abc", text: "hi" }));
  });

  it("throws with the response body text on a non-200 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '{"error":"Invalid request parameters"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      pumbleRequest("/editMessage", { method: "POST", body: {} }),
    ).rejects.toThrow(/Invalid request parameters/);
  });

  it("resolves with undefined when the response body is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await pumbleRequest("/editMessage", { method: "POST", body: {} });
    expect(result).toBeUndefined();
  });

  it("throws when PUMBLE_API_KEY is not set", async () => {
    delete process.env.PUMBLE_API_KEY;
    vi.stubGlobal("fetch", vi.fn());

    await expect(pumbleRequest("/listChannels", { method: "GET" })).rejects.toThrow(
      "PUMBLE_API_KEY",
    );
  });
});
