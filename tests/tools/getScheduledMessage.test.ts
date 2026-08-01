import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getScheduledMessage } from "../../src/tools/getScheduledMessage.js";
import { callTo, mockPumble } from "../helpers/mockPumble.js";

describe("getScheduledMessage", () => {
  beforeEach(() => {
    process.env.PUMBLE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUMBLE_API_KEY;
  });

  it("calls GET /fetchScheduledMessage with the ID as a query param", async () => {
    const fetchMock = mockPumble({ "/fetchScheduledMessage": { id: "sch123", text: "hello" } });

    const result = await getScheduledMessage({ scheduledMessageId: "sch123" });

    expect(result).toEqual({ id: "sch123", text: "hello" });
    const { url, method } = callTo(fetchMock, "/fetchScheduledMessage");
    expect(method).toBe("GET");
    expect(url).toContain("scheduledMessageId=sch123");
  });
});
