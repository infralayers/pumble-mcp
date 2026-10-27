import { z } from "zod";
import { getChannelsList, clearCache } from "./resolve.js";

export const listChannelsShape = {};
export const listChannelsSchema = z.object(listChannelsShape).strict();

export type ListChannelsInput = z.infer<typeof listChannelsSchema>;

export function clearListChannelsCache() {
  clearCache();
}

export async function listChannels(_input: ListChannelsInput) {
  const channels = await getChannelsList();
  return channels.map((item) => {
    const ch = item.channel || (item as any);
    const res: Record<string, any> = {
      id: ch.id,
      name: ch.name,
      type: ch.channelType,
      isArchived: Boolean(ch.isArchived),
      creator: ch.creator,
      createdAt: ch.createdAt,
      memberCount: Array.isArray(item.users) ? item.users.length : 0,
    };
    if (ch.topic) res.topic = ch.topic;
    if (ch.description) res.description = ch.description;
    return res;
  });
}
