import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isLikelyId,
  matchChannelsByName,
  matchUsersByNameOrEmail,
  resolveChannelId,
  resolveUserId,
} from "../../src/tools/resolve.js";

describe("isLikelyId", () => {
  it("recognizes 24-char hex strings as IDs", () => {
    expect(isLikelyId("507f1f77bcf86cd799439011")).toBe(true);
  });

  it("rejects names and emails", () => {
    expect(isLikelyId("general")).toBe(false);
    expect(isLikelyId("a@b.com")).toBe(false);
    expect(isLikelyId("507f1f77bcf86cd79943901")).toBe(false); // 23 chars
  });
});

describe("matchChannelsByName / matchUsersByNameOrEmail", () => {
  it("matches case-insensitively", () => {
    const channels = [{ channel: { id: "c1", name: "General" } }];
    expect(matchChannelsByName("general", channels)).toHaveLength(1);

    const users = [{ id: "u1", name: "Jordan Blake", email: "jordan@example.com" }];
    expect(matchUsersByNameOrEmail("JORDAN@EXAMPLE.COM", users)).toHaveLength(1);
  });

  it("returns every match when a name is ambiguous", () => {
    const users = [
      { id: "u1", name: "Casey Morgan", email: "casey.old@example.com" },
      { id: "u2", name: "Casey Morgan", email: "casey.new@example.com" },
    ];
    expect(matchUsersByNameOrEmail("Casey Morgan", users)).toHaveLength(2);
  });
});

describe("resolveChannelId / resolveUserId", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("resolveChannelId passes raw IDs through without a fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveChannelId("507f1f77bcf86cd799439011")).resolves.toBe("507f1f77bcf86cd799439011");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolveUserId throws on zero matches", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify([]) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUserId("Ghost User")).rejects.toThrow(/could not be found/);
  });

  it("resolveUserId throws listing candidates on ambiguous matches", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { id: "u1", name: "Casey Morgan", email: "casey.old@example.com" },
          { id: "u2", name: "Casey Morgan", email: "casey.new@example.com" },
        ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUserId("Casey Morgan")).rejects.toThrow(/matches multiple users.*u1.*u2|matches multiple users/);
  });

  it("resolveChannelId returns the single match's id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ channel: { id: "c1", name: "general" } }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveChannelId("general")).resolves.toBe("c1");
  });
});
