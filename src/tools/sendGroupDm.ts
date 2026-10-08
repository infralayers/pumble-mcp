import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveUserId } from "./resolve.js";

export const sendGroupDmShape = {
  text: z.string().min(1).describe("The message text to send"),
  users: z.array(z.string()).describe("Recipients: user IDs, emails, or names (2-8 total)."),
};

export const sendGroupDmSchema = z.object(sendGroupDmShape).refine(
  (v) => v.users.length >= 2 && v.users.length <= 8,
  {
    message: "Pumble requires between 2 and 8 recipients for a Group DM. For a single recipient, use pumble_send_dm.",
  },
);

export type SendGroupDmInput = z.infer<typeof sendGroupDmSchema>;

export async function sendGroupDm(input: SendGroupDmInput) {
  const resolvedIds = await Promise.all(input.users.map((identifier) => resolveUserId(identifier)));
  const finalUserIds = Array.from(new Set(resolvedIds));

  if (finalUserIds.length < 2) {
    throw new Error("Pumble requires at least 2 recipients for a Group DM. For a single recipient, please use the pumble_send_dm tool instead.");
  }
  if (finalUserIds.length > 8) {
    throw new Error(`Pumble allows a maximum of 8 recipients for a Group DM (you provided ${finalUserIds.length}).`);
  }

  return pumbleRequest<{ id: string }>("/dmGroup", {
    method: "POST",
    body: {
      text: input.text,
      userIds: finalUserIds,
    },
  });
}
