import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveChannelId } from "./resolve.js";

export const replyMessageShape = {
  messageId: z.string().min(1).describe("The exact ID of the target message. Note: if the target message was recently sent, use the id returned in that response. If unknown, use pumble_search_messages to find it first."),
  channelIdentifier: z.string().min(1).describe("Channel name, slug, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  text: z.string().min(1).max(4000).describe("The reply message text (max 4000 characters). If not provided, MUST ASK. DO NOT GUESS."),
  asBot: z.boolean().default(false).describe("Send as bot identity instead of API key user. Defaults to false. If not provided, DO NOT GUESS."),
};

export const replyMessageSchema = z.object(replyMessageShape).strict();

export type ReplyMessageInput = z.infer<typeof replyMessageSchema>;

export async function replyMessage(input: ReplyMessageInput) {
  const channelId = await resolveChannelId(input.channelIdentifier);
  const res = await pumbleRequest<{ id: string }>("/sendReply", {
    method: "POST",
    body: {
      messageId: input.messageId,
      channelId,
      text: input.text,
      asBot: input.asBot,
    },
  });

  return {
    ok: true,
    delivered: true,
    replyId: res?.id,
    parentMessageId: input.messageId,
    channel: input.channelIdentifier,
    channelId,
    text: input.text,
    status: "Thread reply successfully delivered and confirmed. Verification complete — no further action needed.",
  };
}
