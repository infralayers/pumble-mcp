import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const updateCustomStatusShape = {
  status: z.string().min(1).max(128).describe("The status message text (1-128 chars). (Do not guess)"),
  code: z.string().min(1).describe("Emoji code shorthand (e.g. ':joy:'). (Do not guess)"),
  expiration: z
    .enum(["dont_clear", "30m", "1h", "4h", "today", "this_week", "custom"])
    .optional()
    .describe("Status expiration mode (e.g., 'this_week', '1h', 'dont_clear'). (Do not guess)"),
  expiresAt: z
    .union([z.number(), z.string()])
    .describe(
      "REQUIRED. The exact timestamp when the status expires. Pass 0 if you want 'dont_clear' (never expires). Otherwise pass an ISO-8601 string or numeric ms timestamp. (Do not guess)"
    ),
};

export const updateCustomStatusSchema = z.object(updateCustomStatusShape);

export type UpdateCustomStatusInput = z.infer<typeof updateCustomStatusSchema>;

export async function updateCustomStatus(input: UpdateCustomStatusInput) {
  let expiresAtMs: number = 0;
  
  if (input.expiresAt !== undefined) {
    if (typeof input.expiresAt === "number") {
      expiresAtMs = input.expiresAt;
    } else {
      const parsed = Date.parse(input.expiresAt);
      if (isNaN(parsed)) {
        throw new Error("Invalid ISO-8601 date string provided for expiresAt.");
      }
      expiresAtMs = parsed;
    }
  }

  return pumbleRequest<{ ok?: boolean }>("/customStatus", {
    method: "POST",
    body: {
      code: input.code,
      status: input.status,
      ...(input.expiration && { expiration: input.expiration }),
      expiresAt: expiresAtMs,
    },
  });
}
