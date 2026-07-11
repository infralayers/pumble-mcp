import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const sendDmShape = {
  userId: z.string().optional().describe("Recipient's user ID (provide this OR email)"),
  email: z.string().optional().describe("Recipient's email (provide this OR userId)"),
  text: z.string().describe("The message text to send"),
};

export const sendDmSchema = z
  .object(sendDmShape)
  .refine((v) => Boolean(v.userId) !== Boolean(v.email), {
    message: "Provide exactly one of `userId` or `email`",
  });

export type SendDmInput = z.infer<typeof sendDmSchema>;

export async function sendDm(input: SendDmInput) {
  return pumbleRequest<{ id: string }>("/dmUser", {
    method: "POST",
    body: input,
  });
}
