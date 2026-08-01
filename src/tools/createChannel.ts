import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const createChannelShape = {
  name: z.string().min(1).describe(
    "The name of the new channel. (Do not guess)"
  ),
  type: z.enum(["PUBLIC", "PRIVATE"]).describe(
    "The type of the channel (PUBLIC or PRIVATE). (Do not guess)"
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
