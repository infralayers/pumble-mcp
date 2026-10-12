import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const listChannelsShape = {
  confirmationToken: z.string().optional().describe("One-time security confirmation token authorized by the human user."),
};
export const listChannelsSchema = z.object(listChannelsShape).strict();

export type ListChannelsInput = z.infer<typeof listChannelsSchema>;

export async function listChannels(_input: ListChannelsInput) {
  return pumbleRequest<unknown[]>("/listChannels", { method: "GET" });
}
