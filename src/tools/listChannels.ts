import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const listChannelsSchema = z.object({});

export type ListChannelsInput = z.infer<typeof listChannelsSchema>;

export async function listChannels(_input: ListChannelsInput) {
  return pumbleRequest<unknown[]>("/listChannels", { method: "GET" });
}
