import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listChannels } from "./listChannels.js";

export const getChannelShape = {
  channel: z.string().optional().describe("Channel name (provide this OR channelId). STRICT RULE: You MUST ask the user for this value if they did not explicitly provide it."),
  channelId: z.string().optional().describe("Channel ID (provide this OR channel). STRICT RULE: You MUST ask the user for this value if they did not explicitly provide it."),
};

export const getChannelSchema = z
  .object(getChannelShape)
  .refine((v) => Boolean(v.channel) !== Boolean(v.channelId), {
    message: "Provide exactly one of `channel` or `channelId`",
  });

export type GetChannelInput = z.infer<typeof getChannelSchema>;

export async function getChannel(input: GetChannelInput) {
  let targetChannelId = input.channelId;

  // If a name is provided instead of an ID, resolve it
  if (input.channel) {
    const channelsList = (await listChannels({})) as any[];
    const lowerIdentifier = input.channel.toLowerCase();
    
    const matchedChannel = channelsList.find((c: any) => 
      c.channel && c.channel.name && c.channel.name.toLowerCase() === lowerIdentifier
    );

    if (matchedChannel && matchedChannel.channel) {
      targetChannelId = matchedChannel.channel.id;
    } else {
      throw new Error(
        `Error: Channel with name '${input.channel}' could not be found in the workspace.\n` +
        `ACTION REQUIRED: Stop and USE the 'list_channels' TOOL to retrieve the actual list of available channels.\n` +
        `If you find a close match, ask the human to confirm it.\n` +
        `If not, present the list of all public/private available channels with their NAMES and IDs to the human.`
      );
    }
  }

  // Use the resolved targetChannelId
  return pumbleRequest<unknown>("/getChannel", {
    method: "GET",
    query: { channelId: targetChannelId },
  });
}
