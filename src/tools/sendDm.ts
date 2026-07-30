import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveUserId } from "./resolve.js";

export const sendDmShape = {
  userIdentifier: z.string().min(1).describe("The name, email, or ID of the user. (Do not guess)"),
  text: z.string().min(1).describe("The message text to send. (Do not guess)"),
};

export const sendDmSchema = z.object(sendDmShape);

export type SendDmInput = z.infer<typeof sendDmSchema>;

export async function sendDm(input: SendDmInput) {
  const userId = await resolveUserId(input.userIdentifier);
  return pumbleRequest<{ id: string }>("/dmUser", {
    method: "POST",
    body: { userId, text: input.text },
  });
}
