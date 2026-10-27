import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId, userCache, getUsersList } from "./resolve.js";

export const getMessageShape = {
  messageId: z
    .string()
    .min(1)
    .describe("The exact ID of the message to retrieve. If not provided, MUST ASK. DO NOT GUESS."),
  channelIdentifier: z
    .string()
    .min(1)
    .describe("Channel name, slug, or ID where the message is located. If not provided, MUST ASK. DO NOT GUESS."),
};

export const getMessageSchema = z.object(getMessageShape).strict();

export type GetMessageInput = z.infer<typeof getMessageSchema>;

export async function getMessage(input: GetMessageInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);

  const raw = await pumbleRequest<any>("/fetchMessage", {
    method: "GET",
    query: {
      messageId: input.messageId,
      channelId,
    },
  });

  const users = userCache ?? (await getUsersList().catch(() => []));
  const userMap = new Map<string, string>();
  if (Array.isArray(users)) {
    for (const u of users) {
      if (u.id) userMap.set(u.id, u.name || u.realName || u.id);
    }
  }

  const authorName = (raw?.author && userMap.get(raw.author)) || raw?.author;

  const message: Record<string, unknown> = {
    id: raw?.id || input.messageId,
    channelId: raw?.channelId || channelId,
  };
  if (authorName) message.author = authorName;
  if (raw?.text && typeof raw.text === "string" && raw.text.trim()) message.text = raw.text;
  if (raw?.timestamp) message.timestamp = raw.timestamp;
  if (raw?.edited) message.edited = true;
  if (raw?.reactions?.length) {
    message.reactions = [...new Set(raw.reactions.map((r: any) => r.code || r))];
  }
  if (raw?.files?.length) {
    message.files = raw.files.map((f: any) => f.name || f.id);
  }
  if (raw?.threadRootInfo?.repliesCount) {
    message.threadRepliesCount = raw.threadRootInfo.repliesCount;
  }

  return message;
}
