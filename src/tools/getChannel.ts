import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const getChannelShape = {
  channel: z.string().optional().describe("Channel name (provide this OR channelId). Ask the user for this value if they haven't provided it - don't guess."),
  channelId: z.string().optional().describe("Channel ID (provide this OR channel). Ask the user for this value if they haven't provided it - don't guess."),
};

export const getChannelSchema = z
  .object(getChannelShape)
  .refine((v) => Boolean(v.channel) !== Boolean(v.channelId), {
    message: "Provide exactly one of `channel` or `channelId`",
  });

export type GetChannelInput = z.infer<typeof getChannelSchema>;

export async function getChannel(input: GetChannelInput) {
  const targetChannelId = input.channel ? await resolveChannelId(input.channel) : input.channelId!;

  return pumbleRequest<unknown>("/getChannel", {
    method: "GET",
    query: { channelId: targetChannelId },
  });
}
