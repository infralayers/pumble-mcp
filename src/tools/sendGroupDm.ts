import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveUserId } from "./resolve.js";



export const sendGroupDmShape = {
  text: z.string().min(1).describe("The message text to send"),
  userIds: z.array(z.string()).describe("Array of recipient user IDs. You must pass an empty array [] if not used."),
  emails: z.array(z.string().email()).describe("Array of recipient email addresses. You must pass an empty array [] if not used."),
  userNames: z.array(z.string()).describe("Array of recipient names to search for and resolve to IDs. You must pass an empty array [] if not used."),
};

export const sendGroupDmSchema = z
  .object(sendGroupDmShape)
  .refine(
    (v) => {
      const count = v.userIds.length + v.emails.length + v.userNames.length;
      return count >= 2 && count <= 8;
    },
    {
      message: "Pumble requires between 2 and 8 recipients for a Group DM. For a single recipient, use pumble_send_dm. DO NOT attempt any inference or guessing of missing information.",
    }
  );

export type SendGroupDmInput = z.infer<typeof sendGroupDmSchema>;
export async function sendGroupDm(input: SendGroupDmInput) {
  let finalUserIds = [...input.userIds];

  if (input.userNames.length > 0 || input.emails.length > 0) {
    const allIdentifiers = [...input.emails, ...input.userNames];
    
    for (const target of allIdentifiers) {
      const resolvedId = await resolveUserId(target);
      finalUserIds.push(resolvedId);
    }
  }

  // Deduplicate IDs
  finalUserIds = Array.from(new Set(finalUserIds));
  const totalRecipients = finalUserIds.length;

  if (totalRecipients < 2) {
    throw new Error("Pumble requires at least 2 recipients for a Group DM. For a single recipient, please use the pumble_send_dm tool instead.");
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
