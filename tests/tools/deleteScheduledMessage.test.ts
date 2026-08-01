import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteScheduledMessageSchema, deleteScheduledMessage } from "../../src/tools/deleteScheduledMessage.js";
import { callTo, mockPumble } from "../helpers/mockPumble.js";

describe("deleteScheduledMessageSchema", () => {
  it("refuses to delete without explicit confirmation", () => {
    const res = deleteScheduledMessageSchema.safeParse({
      scheduledMessageId: "6a5f4bbce0addeac89ba9d1d",
      confirm: false,
    });
    expect(res.success).toBe(false);
  });
});

describe("deleteScheduledMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  // Pumble 403s a DELETE that carries the ID in the body, so it has to go in
  // the query string.
  it("sends a DELETE with the scheduled message ID as a query param", async () => {
    const fetchMock = mockPumble({ "/deleteScheduledMessage": { ok: true } });

    const input = deleteScheduledMessageSchema.parse({
      scheduledMessageId: "sch123",
      confirm: true,
    });
    const result = await deleteScheduledMessage(input);

    expect(result).toEqual({ ok: true });
    const { method, url, body } = callTo(fetchMock, "/deleteScheduledMessage");
    expect(method).toBe("DELETE");
    expect(url).toContain("scheduledMessageId=sch123");
    expect(body).toBeUndefined();
  });
});
