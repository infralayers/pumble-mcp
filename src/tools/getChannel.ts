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

  const [channelData, allUsers] = await Promise.all([
    pumbleRequest<any>("/getChannel", { method: "GET", query: { channelId: targetChannelId } }),
    pumbleRequest<any[]>("/listUsers", { method: "GET" })
  ]);

  if (channelData && channelData.users && Array.isArray(channelData.users)) {
    channelData.memberDetails = channelData.users.map((userId: string) => {
      const user = allUsers.find((u) => u.id === userId);
      return user 
        ? { id: user.id, name: user.name, email: user.email } 
        : { id: userId, name: "Unknown", email: "Unknown" };
    });
  }

  return channelData;
}
