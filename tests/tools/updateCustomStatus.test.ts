import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateCustomStatusSchema, updateCustomStatus } from "../../src/tools/updateCustomStatus.js";

describe("updateCustomStatusSchema", () => {
  it("validates when status, code, and expiresAt (number) are present", () => {
    const res = updateCustomStatusSchema.safeParse({
      status: "Coding",
      code: ":keyboard:",
      expiration: "custom",
      expiresAt: 1775654338000,
    });
    expect(res.success).toBe(true);
  });

  it("validates when status, code, and expiresAt (string) are present", () => {
    const res = updateCustomStatusSchema.safeParse({
      status: "Coding",
      code: ":keyboard:",
      expiration: "custom",
      expiresAt: "2026-07-28T14:00:00+05:00",
    });
    expect(res.success).toBe(true);
  });

  it("validates when status is missing (clearing status)", () => {
    const res = updateCustomStatusSchema.safeParse({
      code: ":keyboard:",
    });
    expect(res.success).toBe(true);
  });

  it("validates when code is missing (clearing status)", () => {
    const res = updateCustomStatusSchema.safeParse({
      status: "Coding",
    });
    expect(res.success).toBe(true);
  });

  it("validates when expiresAt is missing (defaults to never)", () => {
    const res = updateCustomStatusSchema.safeParse({
      status: "Coding",
      code: ":keyboard:",
    });
    expect(res.success).toBe(true);
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
      expiration: "custom",
      expiresAt: 1775654338000,
    });

    expect(result).toEqual({ ok: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(options.body).toBe(
      JSON.stringify({
        code: ":calendar:",
        status: "In a meeting",
        expiration: "custom",
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
      expiration: "custom",
      expiresAt: "2026-07-28T14:00:00+05:00",
    });

    expect(result).toEqual({ ok: true });
    const [url, options] = fetchMock.mock.calls[0];
    const parsedBody = JSON.parse(options.body as string);
    expect(parsedBody.expiresAt).toBe(Date.parse("2026-07-28T14:00:00+05:00"));
  });

  it("throws when expiresAt is an invalid date string for custom expiration", async () => {
    await expect(
      updateCustomStatus({
        status: "In a meeting",
        code: ":calendar:",
        expiration: "custom",
        expiresAt: "invalid-date-string",
      })
    ).rejects.toThrow("Invalid date format for expiresAt: invalid-date-string");
  });

  it("calculates expiresAt for never (dont_clear)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateCustomStatus({
      status: "Working",
      code: ":computer:",
      expiration: "never",
    });

    const [url, options] = fetchMock.mock.calls[0];
    const parsedBody = JSON.parse(options.body as string);
    expect(parsedBody.expiresAt).toBe(4093062627467);
  });

  it("sends empty string for code and status when omitting to clear", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateCustomStatus({
      expiration: "never",
    });

    const [url, options] = fetchMock.mock.calls[0];
    const parsedBody = JSON.parse(options.body as string);
    expect(parsedBody.code).toBe("");
    expect(parsedBody.status).toBe("");
    expect(parsedBody.expiresAt).toBe(4093062627467);
  });
});
