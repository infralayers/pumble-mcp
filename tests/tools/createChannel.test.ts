import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChannel, createChannelSchema } from "../../src/tools/createChannel.js";

describe("createChannelSchema", () => {
  it("rejects when name is missing", () => {
    expect(createChannelSchema.safeParse({ type: "PUBLIC" }).success).toBe(false);
  });

  it("rejects when type is missing", () => {
    expect(createChannelSchema.safeParse({ name: "my-channel" }).success).toBe(false);
  });

  it("rejects when type is invalid", () => {
    expect(createChannelSchema.safeParse({ name: "my-channel", type: "SECRET" }).success).toBe(false);
  });

  it("accepts valid input", () => {
    expect(createChannelSchema.safeParse({ name: "my-channel", type: "PUBLIC" }).success).toBe(true);
    expect(createChannelSchema.safeParse({ name: "my-private-channel", type: "PRIVATE" }).success).toBe(true);
  });
});

describe("createChannel", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("makes a POST request to /createChannel with the correct body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "new-channel-id", name: "my-channel" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = createChannelSchema.parse({ name: "my-channel", type: "PRIVATE" });
    const result = await createChannel(input);

    expect(result).toEqual({ id: "new-channel-id", name: "my-channel" });
    
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/createChannel");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ name: "my-channel", type: "PRIVATE" }));
  });
});
