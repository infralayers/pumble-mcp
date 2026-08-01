import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editScheduledMessageSchema, editScheduledMessage } from "../../src/tools/editScheduledMessage.js";
import { callTo, mockPumble } from "../helpers/mockPumble.js";

const EXISTING = {
  id: "sch123",
  channelId: "chan-old",
  text: "Old text",
  sendAt: 1784620000000,
};

describe("editScheduledMessageSchema", () => {
  it("rejects more than one destination", () => {
    const res = editScheduledMessageSchema.safeParse({
      scheduledMessageId: EXISTING.id,
      channel: "general",
      userId: "507f1f77bcf86cd799439011",
    });
    expect(res.success).toBe(false);
  });
});

describe("editScheduledMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("keeps the existing text and sendAt when only the channel changes", async () => {
    const fetchMock = mockPumble({
      "/fetchScheduledMessage": EXISTING,
      "/listChannels": [{ channel: { id: "chan-general", name: "general", channelType: "PUBLIC" } }],
      "/editScheduledMessage": { ok: true },
    });

    const input = editScheduledMessageSchema.parse({
      scheduledMessageId: EXISTING.id,
      channel: "general",
    });
    await editScheduledMessage(input);

    expect(callTo(fetchMock, "/editScheduledMessage").body).toEqual({
      scheduledMessageId: EXISTING.id,
      channelId: "chan-general",
      text: EXISTING.text,
      sendAt: EXISTING.sendAt,
    });
  });

  it("keeps the existing channel and sendAt when only the text changes", async () => {
    const fetchMock = mockPumble({
      "/fetchScheduledMessage": EXISTING,
      "/editScheduledMessage": { ok: true },
    });

    const input = editScheduledMessageSchema.parse({
      scheduledMessageId: EXISTING.id,
      text: "New text",
    });
    await editScheduledMessage(input);

    expect(callTo(fetchMock, "/editScheduledMessage").body).toEqual({
      scheduledMessageId: EXISTING.id,
      channelId: EXISTING.channelId,
      text: "New text",
      sendAt: EXISTING.sendAt,
    });
  });
});
