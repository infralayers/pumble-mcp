import { describe, it, expect } from "vitest";
import { deleteScheduledMessageSchema } from "../../src/tools/deleteScheduledMessage.js";

describe("deleteScheduledMessageSchema", () => {
  it("validates when confirm is true", () => {
    const res = deleteScheduledMessageSchema.safeParse({
      scheduledMessageId: "6a5f4bbce0addeac89ba9d1d",
      confirm: true,
    });
    expect(res.success).toBe(true);
  });

  it("fails when confirm is false", () => {
    const res = deleteScheduledMessageSchema.safeParse({
      scheduledMessageId: "6a5f4bbce0addeac89ba9d1d",
      confirm: false,
    });
    expect(res.success).toBe(false);
  });

  it("fails when scheduledMessageId is missing", () => {
    const res = deleteScheduledMessageSchema.safeParse({
      confirm: true,
    });
    expect(res.success).toBe(false);
  });
});
