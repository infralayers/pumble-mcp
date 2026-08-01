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

  const mockUsers = [
    { id: "u1", name: "Alice", realName: "Alice Smith", email: "alice.s@example.com" },
    { id: "u2", name: "Alice", realName: "Alice Jones", email: "alice.j@example.com" },
    { id: "u3", name: "Bob", realName: "Bob Builder", email: "bob@example.com" },
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
    const result = sendGroupDmSchema.safeParse({ text: "Hello", userIdentifiers: [] });
    expect(result.success).toBe(false);
  });

  it("validates successful payload", () => {
    const result = sendGroupDmSchema.safeParse({ text: "Hello", userIdentifiers: ["u1", "u2"] });
    expect(result.success).toBe(true);
  });

  it("sends group DM with userIds and emails", async () => {
    const fetchMock = setupFetchMock();
    await sendGroupDm({ text: "Hello", userIdentifiers: ["u4", "alice.s@example.com"] });
    
    expect(fetchMock).toHaveBeenCalledTimes(2); // listUsers + dmGroup
    const dmCall = fetchMock.mock.calls[1];
    expect(dmCall[0].toString()).toContain("/dmGroup");
    expect(dmCall[1].method).toBe("POST");
    expect(JSON.parse(dmCall[1].body as string)).toEqual({
      text: "Hello",
      userIds: ["u4", "u1"],
    });
  });

  it("resolves userNames and combines with exact matches", async () => {
    const fetchMock = setupFetchMock();
    await sendGroupDm({ text: "Hello", userIdentifiers: ["alice.s@example.com", "Bob Builder"] });
    
    const dmCall = fetchMock.mock.calls.find(call => call[0].toString().includes("/dmGroup"));
    expect(dmCall).toBeDefined();
    expect(JSON.parse(dmCall[1].body as string)).toEqual({
      text: "Hello",
      userIds: ["u1", "u3"]
    });
  });

  it("resolves single user by exact name (along with another user)", async () => {
    const fetchMock = setupFetchMock();
    await sendGroupDm({ text: "Hello", userIdentifiers: ["Bob Builder", "alice.s@example.com"] });
    
    const dmCall = fetchMock.mock.calls.find(call => call[0].toString().includes("/dmGroup"));
    expect(dmCall).toBeDefined();
    expect(JSON.parse(dmCall[1].body as string)).toEqual({
      text: "Hello",
      userIds: ["u3", "u1"]
    });
  });

  it("resolves single user by substring (along with another user)", async () => {
    const fetchMock = setupFetchMock();
    await sendGroupDm({ text: "Hello", userIdentifiers: ["Builder", "alice.s@example.com"] });
    
    const dmCall = fetchMock.mock.calls.find(call => call[0].toString().includes("/dmGroup"));
    expect(dmCall).toBeDefined();
    expect(JSON.parse(dmCall[1].body as string)).toEqual({
      text: "Hello",
      userIds: ["u3", "u1"]
    });
  });

  it("throws on ambiguous exact name", async () => {
    setupFetchMock();
    await expect(sendGroupDm({ text: "Hello", userIdentifiers: ["Alice", "Bob"] }))
      .rejects.toThrow(/Ambiguous name 'Alice'. Multiple matches found:.*CRITICAL RULE: DO NOT guess/);
  });

  it("throws on ambiguous substring", async () => {
    setupFetchMock();
    await expect(sendGroupDm({ text: "Hello", userIdentifiers: ["Ali", "Bob"] }))
      .rejects.toThrow(/Ambiguous name 'Ali'. Multiple matches found:.*CRITICAL RULE: DO NOT guess/);
  });

  it("throws when user not found", async () => {
    setupFetchMock();
    await expect(sendGroupDm({ text: "Hello", userIdentifiers: ["Charlie", "Bob"] }))
      .rejects.toThrow(/User not found for 'Charlie'. CRITICAL RULE: DO NOT guess/);
  });

  it("throws when less than 2 recipients are provided", async () => {
    setupFetchMock();
    const result = sendGroupDmSchema.safeParse({ text: "Hello", userIdentifiers: ["u1"] });
    expect(result.success).toBe(false);
  });

  it("throws when more than 8 recipients are provided", async () => {
    setupFetchMock();
    const result = sendGroupDmSchema.safeParse({ text: "Hello", userIdentifiers: ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9"] });
    expect(result.success).toBe(false);
  });
});
