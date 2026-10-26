import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const listChannelsShape = {
  confirmationToken: z.string().optional().describe("One-time security confirmation token authorized by the human user."),
};
export const listChannelsSchema = z.object(listChannelsShape).strict();

export type ListChannelsInput = z.infer<typeof listChannelsSchema>;

export async function listChannels(_input: ListChannelsInput) {
  const raw = await pumbleRequest<any[]>("/listChannels", { method: "GET" });
  return (Array.isArray(raw) ? raw : []).map((item) => {
    const ch = item.channel || item;
    const res: Record<string, any> = {
      id: ch.id,
      name: ch.name,
      type: ch.channelType,
      isArchived: Boolean(ch.isArchived),
      creator: ch.creator || item.creator,
      createdAt: ch.createdAt || item.createdAt,
      memberCount: Array.isArray(item.users) ? item.users.length : 0,
    };
    if (ch.topic) res.topic = ch.topic;
    if (ch.description) res.description = ch.description;
    return res;
  });
}
