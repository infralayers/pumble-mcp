import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const getMyInfoShape = {};
export const getMyInfoSchema = z.object(getMyInfoShape);

export type GetMyInfoInput = z.infer<typeof getMyInfoSchema>;

export async function getMyInfo(_input: GetMyInfoInput) {
  return pumbleRequest<unknown>("/myInfo", { method: "GET" });
}
