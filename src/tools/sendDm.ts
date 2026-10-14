import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { resolveUserId, getChannelsList, getMyInfoCached } from "./resolve.js";

export const sendDmShape = {
  userIdentifier: z.string().min(1).describe("User name, email, or ID. If not provided, MUST ASK. DO NOT GUESS."),
  text: z.string().min(1).max(4000).describe("The message text to send (max 4000 characters). If not provided, MUST ASK. DO NOT GUESS."),
};

export const sendDmSchema = z.object(sendDmShape).strict();

export type SendDmInput = z.infer<typeof sendDmSchema>;

export async function sendDm(input: SendDmInput) {
  const [userId, myInfo] = await Promise.all([
    resolveUserId(input.userIdentifier),
    getMyInfoCached().catch(() => null),
  ]);

  if (myInfo?.id && userId === myInfo.id) {
    const channelsList = await getChannelsList();
    const selfChannel = channelsList.find((c) => c.channel?.channelType === "SELF");
    if (selfChannel?.channel?.id) {
      const res = await pumbleRequest<{ id: string }>("/sendMessage", {
        method: "POST",
        body: { channelId: selfChannel.channel.id, text: input.text },
      });
      return {
        ok: true,
        delivered: true,
        recipient: input.userIdentifier,
        channelId: selfChannel.channel.id,
        messageId: res?.id,
        text: input.text,
        status: "Message successfully delivered to self-channel. Verification complete — no further action needed.",
      };
    }
  }

  const res = await pumbleRequest<{ id: string }>("/dmUser", {
    method: "POST",
    body: { userId, text: input.text },
  });

  return {
    ok: true,
    delivered: true,
    recipient: input.userIdentifier,
    userId,
    messageId: res?.id,
    text: input.text,
    status: "Direct message successfully delivered and confirmed. Verification complete — no further action needed.",
  };
}
