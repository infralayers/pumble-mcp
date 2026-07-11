import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendDm, sendDmSchema } from "../../src/tools/sendDm.js";

describe("sendDmSchema", () => {
  it("rejects when neither userId nor email is given", () => {
    expect(sendDmSchema.safeParse({ text: "hi" }).success).toBe(false);
  });

  it("rejects when both userId and email are given", () => {
    expect(
      sendDmSchema.safeParse({ userId: "u1", email: "a@b.com", text: "hi" }).success,
    ).toBe(false);
  });
});

describe("sendDm", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls POST /dmUser with the parsed input", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "dm1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = sendDmSchema.parse({ userId: "u1", text: "hey there" });
    const result = await sendDm(input);

    expect(result).toEqual({ id: "dm1" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/dmUser");
    expect(JSON.parse(options.body)).toEqual({ userId: "u1", text: "hey there" });
  });
});
