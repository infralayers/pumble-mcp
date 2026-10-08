import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { toEpochMs } from "./createScheduledMessage.js";

export const updateCustomStatusShape = {
  status: z.string().max(128).optional().describe("The status message text (max 128 chars). Send empty string or omit to clear."),
  code: z.string().optional().describe("Emoji code shorthand (e.g. ':joy:'). Send empty string or omit to clear."),
  expiration: z
    .enum(["never", "min30", "hour1", "hour4", "today", "thisWeek", "custom"])
    .optional()
    .describe("Status expiration mode (e.g., 'never', 'min30', 'thisWeek'). Defaults to 'never'."),
  expiresAt: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      "The exact timestamp when the status expires. Required only if expiration is 'custom'."
    ),
};

export const updateCustomStatusSchema = z.object(updateCustomStatusShape);

export type UpdateCustomStatusInput = z.infer<typeof updateCustomStatusSchema>;

export async function updateCustomStatus(input: UpdateCustomStatusInput) {
  let expiresAtMs: number = 0;
  // Default to "never" if not provided
  const expiration = input.expiration || "never";
  const now = new Date();

  if (expiration === "custom") {
    if (input.expiresAt === undefined) {
      throw new Error("expiresAt is required when expiration is 'custom'.");
    }
    expiresAtMs = toEpochMs(input.expiresAt, "expiresAt");
  } else if (expiration === "never") {
    // Pumble requires a far future timestamp for "never"
    expiresAtMs = 4093062627467; // Approx year 2099, matching Pumble client
  } else if (expiration === "min30") {
    expiresAtMs = now.getTime() + 30 * 60 * 1000;
  } else if (expiration === "hour1") {
    expiresAtMs = now.getTime() + 60 * 60 * 1000;
  } else if (expiration === "hour4") {
    expiresAtMs = now.getTime() + 4 * 60 * 60 * 1000;
  } else if (expiration === "today") {
    now.setHours(23, 59, 59, 999);
    expiresAtMs = now.getTime();
  } else if (expiration === "thisWeek") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? 0 : 7);
    now.setDate(diff);
    now.setHours(23, 59, 59, 999);
    expiresAtMs = now.getTime();
  }

  // If clearing status, code and status must be explicitly empty strings
  const code = input.code || "";
  const status = input.status || "";

  return pumbleRequest<{ ok?: boolean }>("/customStatus", {
    method: "POST",
    body: {
      code,
      status,
      expiration,
      expiresAt: expiresAtMs,
    },
  });
}
