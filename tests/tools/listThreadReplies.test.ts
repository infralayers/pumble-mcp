import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listThreadReplies, listThreadRepliesSchema } from "../../src/tools/listThreadReplies.js";

describe("listThreadRepliesSchema", () => {
  it("accepts valid input", () => {
    expect(listThreadRepliesSchema.safeParse({ messageId: "msg1", channelId: "abc" }).success).toBe(true);
  });
});

describe("listThreadReplies", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls GET /fetchThreadReplies with query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = listThreadRepliesSchema.parse({ messageId: "msg1", channelId: "abc", limit: 50 });
    const result = await listThreadReplies(input);

    expect(result).toEqual([]);
    const [url, options] = fetchMock.mock.calls[0];
    
    // Check that query params are correctly appended
    const urlString = url.toString();
    expect(urlString).toContain("/fetchThreadReplies");
    expect(urlString).toContain("rootMessageId=msg1");
    expect(urlString).toContain("channelId=abc");
    expect(urlString).toContain("limit=50");
    
    expect(options.method).toBe("GET");
  });
});
