import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const editMessageShape = {
  messageId: z.string().describe("The ID of the message to edit"),
  channelId: z.string().describe("The ID of the channel the message is in"),
  text: z.string().describe("The new message text"),
};

export const editMessageSchema = z.object(editMessageShape);

export type EditMessageInput = z.infer<typeof editMessageSchema>;

export async function editMessage(input: EditMessageInput) {
  return pumbleRequest<void>("/editMessage", {
    method: "POST",
    body: input,
  });
}
