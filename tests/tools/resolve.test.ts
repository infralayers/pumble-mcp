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

  it("recognizes mock test IDs (u1, c1)", () => {
    expect(isLikelyId("u1")).toBe(true);
    expect(isLikelyId("c99")).toBe(true);
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

  it("supports 3-phase matching and returns deactivated users", () => {
    const users = [
      { id: "u1", name: "Bob Builder", email: "bob@example.com", status: "DEACTIVATED" },
      { id: "u2", name: "Alice", email: "alice@example.com" }
    ];
    // Exact Email
    expect(matchUsersByNameOrEmail("bob@example.com", users)).toHaveLength(1);
    // Exact Name
    expect(matchUsersByNameOrEmail("bob builder", users)).toHaveLength(1);
    // Substring Name
    expect(matchUsersByNameOrEmail("builder", users)).toHaveLength(1);
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

  it("resolveUserId throws on zero matches with DO NOT guess rule", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify([]) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUserId("Ghost User")).rejects.toThrow(/User not found for 'Ghost User'. CRITICAL RULE: DO NOT guess/);
  });

  it("resolveUserId throws on ambiguous matches with DO NOT guess rule", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { id: "u1", name: "Casey Morgan", email: "casey.old@example.com" },
          { id: "u2", name: "Casey Morgan", email: "casey.new@example.com" },
        ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUserId("Casey Morgan")).rejects.toThrow(/Ambiguous name 'Casey Morgan'. Multiple matches found:.*CRITICAL RULE: DO NOT guess/);
  });

  it("resolveUserId throws when resolving an exact email of a DEACTIVATED user", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([
        { id: "u1", name: "Deactivated Bob", email: "bob@example.com", status: "DEACTIVATED" }
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUserId("bob@example.com")).rejects.toThrow(/is deactivated and cannot be added/);
  });

  it("resolveUserId filters out DEACTIVATED users during name matching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([
        { id: "u1", name: "Bob", email: "bob.old@example.com", status: "DEACTIVATED" },
        { id: "u2", name: "Bob", email: "bob.new@example.com", status: "ACTIVE" }
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    // It should successfully resolve to u2 because u1 is deactivated and filtered out, leaving exactly 1 match!
    await expect(resolveUserId("Bob")).resolves.toBe("u2");
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
