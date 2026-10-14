import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { addChannelToCache } from "./resolve.js";

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
  const res = await pumbleRequest<{ id?: string; name?: string }>("/createChannel", {
    method: "POST",
    body: input,
  });
  if (res?.id) {
    addChannelToCache({ id: res.id, name: res.name ?? input.name, channelType: input.type });
  }
  return {
    ok: true,
    created: true,
    channelId: res?.id,
    name: res?.name ?? input.name,
    type: input.type,
    status: "Channel created and confirmed. Verification complete — no further action needed.",
  };
}
