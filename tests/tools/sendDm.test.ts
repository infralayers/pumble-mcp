import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendDm, sendDmSchema } from "../../src/tools/sendDm.js";
import { clearCache } from "../../src/tools/resolve.js";

describe("sendDmSchema", () => {
  it("rejects when userIdentifier is missing", () => {
    expect(sendDmSchema.safeParse({ text: "hi" }).success).toBe(false);
  });
});

describe("sendDm", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
    clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls POST /dmUser with the parsed input", async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/myInfo")) {
        return Promise.resolve({ ok: true, text: async () => JSON.stringify({ id: "u_different" }) });
      }
      if (u.includes("/dmUser")) {
        return Promise.resolve({ ok: true, text: async () => JSON.stringify({ id: "dm1" }) });
      }
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = sendDmSchema.parse({ userIdentifier: "507f1f77bcf86cd799439021", text: "hey there" });
    const result = await sendDm(input);

    expect(result).toMatchObject({
      ok: true,
      delivered: true,
      recipient: "507f1f77bcf86cd799439021",
      userId: "507f1f77bcf86cd799439021",
      messageId: "dm1",
      text: "hey there",
      status: expect.stringContaining("Verification complete"),
    });
    const calledUrls = fetchMock.mock.calls.map(([url]) => url.toString());
    expect(calledUrls.some((u) => u.includes("/dmUser"))).toBe(true);
  });

  it("proactively routes to SELF channel when userIdentifier is the authenticated user", async () => {
    const selfId = "507f1f77bcf86cd799439011";
    const fetchMock = vi.fn().mockImplementation((url) => {
      const u = url.toString();
      if (u.includes("/myInfo")) {
        return Promise.resolve({ ok: true, text: async () => JSON.stringify({ id: selfId, name: "Current User" }) });
      }
      if (u.includes("/listChannels")) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify([
              { channel: { id: "c_self", channelType: "SELF" } },
            ]),
        });
      }
      if (u.includes("/listUsers")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify([{ id: selfId, name: "Current User" }]),
        });
      }
      if (u.includes("/sendMessage")) {
        return Promise.resolve({ ok: true, text: async () => JSON.stringify({ id: "msg_self_1" }) });
      }
      return Promise.resolve({ ok: true, text: async () => "{}" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = sendDmSchema.parse({ userIdentifier: selfId, text: "note to self" });
    const result = await sendDm(input);

    expect(result).toMatchObject({
      ok: true,
      delivered: true,
      recipient: selfId,
      channelId: "c_self",
      messageId: "msg_self_1",
      text: "note to self",
      status: expect.stringContaining("Verification complete"),
    });
    const calledUrls = fetchMock.mock.calls.map(([url]) => url.toString());
    expect(calledUrls.some((u) => u.includes("/dmUser"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/sendMessage"))).toBe(true);
  });
});
