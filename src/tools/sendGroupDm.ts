import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveUserId } from "./resolve.js";



export const sendGroupDmShape = {
  userIdentifiers: z.array(z.string().describe("Array of recipient user names, emails, or IDs. Minimum 2, maximum 8 recipients. (Do not guess)")).min(2).max(8),
  text: z.string().min(1).describe("The message text to send. (Do not guess)"),
};

export const sendGroupDmSchema = z.object(sendGroupDmShape);

export type SendGroupDmInput = z.infer<typeof sendGroupDmSchema>;

export async function sendGroupDm(input: SendGroupDmInput) {
  let finalUserIds: string[] = [];

  for (const target of input.userIdentifiers) {
    const resolvedId = await resolveUserId(target);
    finalUserIds.push(resolvedId);
  }

  // Deduplicate IDs
  finalUserIds = Array.from(new Set(finalUserIds));
  const totalRecipients = finalUserIds.length;

  if (totalRecipients < 2) {
    throw new Error("Pumble requires at least 2 distinct recipients for a Group DM. For a single recipient, please use the pumble_send_dm tool instead.");
  }
  if (totalRecipients > 8) {
    throw new Error(`Pumble allows a maximum of 8 recipients for a Group DM (you provided ${totalRecipients}).`);
  }

  return pumbleRequest<{ id: string }>("/dmGroup", {
    method: "POST",
    body: {
      text: input.text,
      userIds: finalUserIds,
    },
  });
}
