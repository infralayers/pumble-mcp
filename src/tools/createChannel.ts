import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const createChannelShape = {
  name: z.string().describe(
  //avoid AI from making assumptions about the channel name or type. AI works autonomously if not given explicit instructions.
    "The name of the new channel. STRICT RULE: " +
    "You MUST ask the user for this value if they did not explicitly provide it. " +
    "DO NOT guess or assume this value under any circumstances."
  ),
  type: z.enum(["PUBLIC", "PRIVATE"]).describe(
    "The type of the channel (PUBLIC or PRIVATE). STRICT RULE: " +
    "You MUST ask the user for this value if they did not explicitly provide it. " +
    "DO NOT guess, assume, or default this value under any circumstances."
  ),
};

export const createChannelSchema = z.object(createChannelShape);

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export async function createChannel(input: CreateChannelInput) {
  return pumbleRequest<unknown>("/createChannel", {
    method: "POST",
    body: input,
  });
}
