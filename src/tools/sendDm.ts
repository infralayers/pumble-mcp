import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveUserId } from "./resolve.js";
import { listChannels } from "./listChannels.js";

export const sendDmShape = {
  userIdentifier: z.string().min(1).describe("User name, email, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  text: z.string().min(1).max(4000).describe("The message text to send (max 4000 characters). If not provided, MUST ASK. DO NOT GUESS."),
};

export const sendDmSchema = z.object(sendDmShape).strict();

export type SendDmInput = z.infer<typeof sendDmSchema>;

export async function sendDm(input: SendDmInput) {
  const userId = await resolveUserId(input.userIdentifier);
  
  try {
    return await pumbleRequest<{ id: string }>("/dmUser", {
      method: "POST",
      body: { userId, text: input.text },
    });
  } catch (error: any) {
    if (error.message && (error.message.includes("less than 2 users") || error.message.includes("400431"))) {
      const channelsList = (await listChannels({})) as any[];
      const selfChannel = channelsList.find(c => c.channel?.channelType === "SELF");
      
      if (selfChannel) {
        return await pumbleRequest<{ id: string }>("/sendMessage", {
          method: "POST",
          body: { channelId: selfChannel.channel.id, text: input.text }
        });
      }
    }
    throw error;
  }
}
