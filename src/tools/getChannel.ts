import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const getChannelShape = {
  channelIdentifier: z.string().min(1).describe("The name or ID of the channel. (Do not guess)"),
};

export const getChannelSchema = z.object(getChannelShape);

export type GetChannelInput = z.infer<typeof getChannelSchema>;

export async function getChannel(input: GetChannelInput) {
  const targetChannelId = await resolveChannelId(input.channelIdentifier);

  return pumbleRequest<unknown>("/getChannel", {
    method: "GET",
    query: { channelId: targetChannelId },
  });
}
