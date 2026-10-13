import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveUserId } from "./resolve.js";



export const sendGroupDmShape = {
  userIdentifiers: z
    .array(z.string().describe("Recipient user name, email, or ID. If not provided, MUST ASK. DO NOT GUESS."))
    .min(2)
    .max(8)
    .describe("Array of recipient user names, emails, or IDs (min 2, max 8). If not provided, MUST ASK. DO NOT GUESS."),
  text: z.string().min(1).max(4000).describe("The message text to send (max 4000 characters). If not provided, MUST ASK. DO NOT GUESS."),
};

export const sendGroupDmSchema = z.object(sendGroupDmShape).strict();

export type SendGroupDmInput = z.infer<typeof sendGroupDmSchema>;

export async function sendGroupDm(input: SendGroupDmInput) {
  let finalUserIds = await Promise.all(
    input.userIdentifiers.map(id => resolveUserId(id))
  );

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
