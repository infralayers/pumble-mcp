import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const updateCustomStatusShape = {
  status: z.string().min(1).max(128).describe("The status message text (1-128 chars)."),
  code: z.string().min(1).describe("Emoji code shorthand (e.g. ':joy:')."),
  expiration: z
    .enum(["dont_clear", "30m", "1h", "4h", "today", "this_week", "custom"])
    .optional()
    .describe("Status expiration mode."),
  expiresAt: z
    .union([z.number(), z.string()])
    .describe(
      "Format relative times as an ISO-8601 string (e.g., '2026-07-28T14:00:00+05:00') using the local offset. Do not calculate epoch milliseconds."
    ),
};

export const updateCustomStatusSchema = z.object(updateCustomStatusShape);

export type UpdateCustomStatusInput = z.infer<typeof updateCustomStatusSchema>;

export async function updateCustomStatus(input: UpdateCustomStatusInput) {
  let expiresAtMs: number;
  if (typeof input.expiresAt === "number") {
    expiresAtMs = input.expiresAt;
  } else {
    const parsed = Date.parse(input.expiresAt);
    if (isNaN(parsed)) {
      throw new Error("Invalid ISO-8601 date string provided for expiresAt.");
    }
    expiresAtMs = parsed;
  }

  return pumbleRequest<{ ok?: boolean }>("/customStatus", {
    method: "POST",
    body: {
      code: input.code,
      status: input.status,
      expiration: input.expiration,
      expiresAt: expiresAtMs,
    },
  });
}
