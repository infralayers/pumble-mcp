import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendGroupDm, sendGroupDmSchema } from "../../src/tools/sendGroupDm.js";

describe("sendGroupDm", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  const ALICE_SMITH_ID = "507f1f77bcf86cd799439011";
  const ALICE_JONES_ID = "507f1f77bcf86cd799439012";
  const BOB_ID = "507f1f77bcf86cd799439013";
  const RAW_ID = "507f1f77bcf86cd799439099";

  const mockUsers = [
    { id: ALICE_SMITH_ID, name: "Alice", realName: "Alice Smith", email: "alice.s@example.com" },
    { id: ALICE_JONES_ID, name: "Alice", realName: "Alice Jones", email: "alice.j@example.com" },
    { id: BOB_ID, name: "Bob", realName: "Bob Builder", email: "bob@example.com" },
  ];

  function setupFetchMock() {
    const fetchMock = vi.fn().mockImplementation(async (url: any, options?: any) => {
      const urlStr = url.toString();
      if (urlStr.includes("/listUsers") && options?.method === "GET") {
        return {
          ok: true,
          text: async () => JSON.stringify(mockUsers),
        };
      }
      if (urlStr.includes("/dmGroup") && options?.method === "POST") {
        return {
          ok: true,
          text: async () => JSON.stringify({ id: "dm_123" }),
        };
      }
      return { ok: false, text: async () => "Not Found" };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("validates missing recipients", () => {
    const result = sendGroupDmSchema.safeParse({ text: "Hello", users: [] });
    expect(result.success).toBe(false);
  });

  it("validates successful payload", () => {
    const result = sendGroupDmSchema.safeParse({ text: "Hello", users: [ALICE_SMITH_ID, BOB_ID] });
    expect(result.success).toBe(true);
  });

  it("sends group DM with a raw ID and an email", async () => {
    const fetchMock = setupFetchMock();
    await sendGroupDm({ text: "Hello", users: [RAW_ID, "alice.s@example.com"] });

    const dmCall = fetchMock.mock.calls.find((call) => call[0].toString().includes("/dmGroup"));
    expect(dmCall).toBeDefined();
    expect(JSON.parse(dmCall![1].body as string)).toEqual({
      text: "Hello",
      userIds: [RAW_ID, ALICE_SMITH_ID],
    });
  });

  it("resolves names and emails together", async () => {
    const fetchMock = setupFetchMock();
    await sendGroupDm({ text: "Hello", users: ["alice.s@example.com", "Bob Builder"] });

    const dmCall = fetchMock.mock.calls.find((call) => call[0].toString().includes("/dmGroup"));
    expect(dmCall).toBeDefined();
    expect(JSON.parse(dmCall![1].body as string)).toEqual({
      text: "Hello",
      userIds: [ALICE_SMITH_ID, BOB_ID],
    });
  });

  it("resolves a single user by substring name (along with another user)", async () => {
    const fetchMock = setupFetchMock();
    await sendGroupDm({ text: "Hello", users: ["Builder", "alice.s@example.com"] });

    const dmCall = fetchMock.mock.calls.find((call) => call[0].toString().includes("/dmGroup"));
    expect(dmCall).toBeDefined();
    expect(JSON.parse(dmCall![1].body as string)).toEqual({
      text: "Hello",
      userIds: [BOB_ID, ALICE_SMITH_ID],
    });
  });

  it("throws on ambiguous exact name", async () => {
    setupFetchMock();
    await expect(sendGroupDm({ text: "Hello", users: ["Alice", "Bob"] })).rejects.toThrow(
      /'Alice' matches multiple users/,
    );
  });

  it("throws on ambiguous substring", async () => {
    setupFetchMock();
    await expect(sendGroupDm({ text: "Hello", users: ["Ali", "Bob"] })).rejects.toThrow(
      /'Ali' matches multiple users/,
    );
  });

  it("throws when user not found", async () => {
    setupFetchMock();
    await expect(sendGroupDm({ text: "Hello", users: ["Charlie", "Bob Builder"] })).rejects.toThrow(
      /Charlie' could not be found/,
    );
  });

  it("throws when less than 2 recipients are provided", () => {
    const result = sendGroupDmSchema.safeParse({ text: "Hello", users: [ALICE_SMITH_ID] });
    expect(result.success).toBe(false);
  });

  it("throws when more than 8 recipients are provided", () => {
    const result = sendGroupDmSchema.safeParse({
      text: "Hello",
      users: ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9"],
    });
    expect(result.success).toBe(false);
  });
});
