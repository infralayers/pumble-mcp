import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const createChannelShape = {
  name: z.string().describe(
    "The name of the new channel. Ask the user for this value if they haven't provided it - don't guess a name."
  ),
  type: z.enum(["PUBLIC", "PRIVATE"]).describe(
    "The type of the channel (PUBLIC or PRIVATE). Ask the user for this value if they haven't provided it - don't default it."
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
