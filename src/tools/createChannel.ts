import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const createChannelShape = {
  name: z.string().min(1).describe("The name of the new channel. If not provided, MUST ASK. DO NOT GUESS."),
  type: z
    .enum(["PUBLIC", "PRIVATE"])
    .default("PUBLIC")
    .describe("The type of the channel (PUBLIC or PRIVATE). Defaults to PUBLIC unless private is explicitly requested."),
};

export const createChannelSchema = z.object(createChannelShape).strict();

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export async function createChannel(input: CreateChannelInput) {
  return pumbleRequest<unknown>("/createChannel", {
    method: "POST",
    body: input,
  });
}
