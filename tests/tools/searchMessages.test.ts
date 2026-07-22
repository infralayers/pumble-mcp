import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchMessages, searchMessagesSchema } from "../../src/tools/searchMessages.js";

describe("searchMessagesSchema", () => {
  it("rejects when none of text, fromUser, or inChannel are provided", () => {
    expect(searchMessagesSchema.safeParse({}).success).toBe(false);
  });

  it("accepts when only text is provided", () => {
    expect(searchMessagesSchema.safeParse({ text: "dokploy" }).success).toBe(true);
  });

  it("accepts when only fromUser is provided", () => {
    expect(searchMessagesSchema.safeParse({ fromUser: "nouman" }).success).toBe(true);
  });

  it("accepts when only inChannel is provided", () => {
    expect(searchMessagesSchema.safeParse({ inChannel: "office-work" }).success).toBe(true);
  });

  it("transforms single string fromUser/inChannel to array", () => {
    const result = searchMessagesSchema.parse({ fromUser: "nouman", inChannel: "general" });
    expect(result.fromUser).toEqual(["nouman"]);
    expect(result.inChannel).toEqual(["general"]);
  });
  
  it("accepts arrays directly", () => {
    const result = searchMessagesSchema.parse({ fromUser: ["u1", "u2"], inChannel: ["c1"] });
    expect(result.fromUser).toEqual(["u1", "u2"]);
    expect(result.inChannel).toEqual(["c1"]);
  });
});

describe("searchMessages", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls POST /searchMessages with exactly the provided input when no resolving is needed", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      return {
        ok: true,
        text: async () => JSON.stringify([{ id: "msg1" }]),
        json: async () => [{ id: "msg1" }],
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({ text: "hello" });
    const result = await searchMessages(input);

    expect(result).toEqual([{ id: "msg1" }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://pumble-api-keys.addons.marketplace.cake.com/searchMessages");
    expect(JSON.parse(options.body)).toEqual({ text: "hello" });
  });

  it("resolves names to IDs correctly via listUsers and listChannels", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlString = url.toString();
      if (urlString.includes("/listUsers")) {
        return {
          ok: true,
          text: async () => JSON.stringify([
            { id: "u123", name: "nouman", email: "nouman@example.com" }
          ]),
          json: async () => [
            { id: "u123", name: "nouman", email: "nouman@example.com" }
          ],
        };
      }
      if (urlString.includes("/listChannels")) {
        return {
          ok: true,
          text: async () => JSON.stringify([
            { channel: { id: "c123", name: "office-work" } }
          ]),
          json: async () => [
            { channel: { id: "c123", name: "office-work" } }
          ],
        };
      }
      if (urlString.includes("/searchMessages")) {
        return {
          ok: true,
          text: async () => JSON.stringify([{ id: "msg_found" }]),
          json: async () => [{ id: "msg_found" }],
        };
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({ 
      text: "agent", 
      fromUser: ["nouman", "u999"], 
      inChannel: ["office-work", "c999"] 
    });
    const result = await searchMessages(input);

    expect(result).toEqual([{ id: "msg_found" }]);
    
    // Check that searchMessages was called with the resolved IDs
    const searchCall = fetchMock.mock.calls.find(c => c[0].toString().includes("/searchMessages"));
    expect(searchCall).toBeDefined();
    
    const body = JSON.parse(searchCall[1].body);
    expect(body).toEqual({
      text: "agent",
      from: ["u123", "u999"], // "nouman" -> "u123", "u999" kept as is
      in: ["c123", "c999"]    // "office-work" -> "c123", "c999" kept as is
    });
  });

  it("skips the users/channels lookup entirely when given real IDs", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlString = url.toString();
      if (urlString.includes("/searchMessages")) {
        return { ok: true, text: async () => JSON.stringify([]) };
      }
      throw new Error(`Unexpected fetch to ${urlString}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({
      text: "agent",
      fromUser: "668e30546a5ea56c5d83f46b",
      inChannel: "668e30546a5ea56c5d83f471",
    });
    await searchMessages(input);

    // Only /searchMessages should be called - no listUsers/listChannels lookup for real IDs
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toEqual(["668e30546a5ea56c5d83f46b"]);
    expect(body.in).toEqual(["668e30546a5ea56c5d83f471"]);
  });

  it("throws instead of guessing when fromUser matches multiple users", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlString = url.toString();
      if (urlString.includes("/listUsers")) {
        return {
          ok: true,
          text: async () => JSON.stringify([
            { id: "u1", name: "AbdulRehman", email: "abdul.old@example.com" },
            { id: "u2", name: "AbdulRehman", email: "abdul.new@example.com" },
          ]),
        };
      }
      throw new Error(`Unexpected fetch to ${urlString}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({ text: "hi", fromUser: "AbdulRehman" });
    await expect(searchMessages(input)).rejects.toThrow(/matches multiple users/);
  });

  it("passes an unresolvable name through as-is rather than throwing", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlString = url.toString();
      if (urlString.includes("/listUsers")) {
        return { ok: true, text: async () => JSON.stringify([]) };
      }
      if (urlString.includes("/searchMessages")) {
        return { ok: true, text: async () => JSON.stringify([]) };
      }
      throw new Error(`Unexpected fetch to ${urlString}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = searchMessagesSchema.parse({ text: "hi", fromUser: "Ghost User" });
    await searchMessages(input);

    const searchCall = fetchMock.mock.calls.find((c) => c[0].toString().includes("/searchMessages"));
    const body = JSON.parse(searchCall[1].body);
    expect(body.from).toEqual(["Ghost User"]);
  });
});
