import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateCustomStatusSchema, updateCustomStatus } from "../../src/tools/updateCustomStatus.js";

describe("updateCustomStatusSchema", () => {
  it("validates when status, code, and expiresAt (number) are present", () => {
    const res = updateCustomStatusSchema.safeParse({
      status: "Coding",
      code: ":keyboard:",
      expiresAt: 1775654338000,
    });
    expect(res.success).toBe(true);
  });

  it("validates when status, code, and expiresAt (string) are present", () => {
    const res = updateCustomStatusSchema.safeParse({
      status: "Coding",
      code: ":keyboard:",
      expiresAt: "2026-07-28T14:00:00+05:00",
    });
    expect(res.success).toBe(true);
  });

  it("fails when status is missing", () => {
    const res = updateCustomStatusSchema.safeParse({
      code: ":keyboard:",
      expiresAt: 1775654338000,
    });
    expect(res.success).toBe(false);
  });

  it("fails when code is missing", () => {
    const res = updateCustomStatusSchema.safeParse({
      status: "Coding",
      expiresAt: 1775654338000,
    });
    expect(res.success).toBe(false);
  });

  it("fails when expiresAt is missing", () => {
    const res = updateCustomStatusSchema.safeParse({
      status: "Coding",
      code: ":keyboard:",
    });
    expect(res.success).toBe(false);
  });
});

describe("updateCustomStatus", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls POST /customStatus with numeric expiresAt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateCustomStatus({
      status: "In a meeting",
      code: ":calendar:",
      expiration: "1h",
      expiresAt: 1775654338000,
    });

    expect(result).toEqual({ ok: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(options.body).toBe(
      JSON.stringify({
        code: ":calendar:",
        status: "In a meeting",
        expiration: "1h",
        expiresAt: 1775654338000,
      })
    );
  });

  it("calls POST /customStatus parsing ISO string expiresAt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateCustomStatus({
      status: "In a meeting",
      code: ":calendar:",
      expiration: "1h",
      expiresAt: "2026-07-28T14:00:00+05:00",
    });

    expect(result).toEqual({ ok: true });
    const [url, options] = fetchMock.mock.calls[0];
    const parsedBody = JSON.parse(options.body as string);
    expect(parsedBody.expiresAt).toBe(Date.parse("2026-07-28T14:00:00+05:00"));
  });

  it("throws when expiresAt is an invalid date string", async () => {
    await expect(
      updateCustomStatus({
        status: "In a meeting",
        code: ":calendar:",
        expiresAt: "invalid-date-string",
      })
    ).rejects.toThrow("Invalid ISO-8601 date string provided for expiresAt.");
  });
});
