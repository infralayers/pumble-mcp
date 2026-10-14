import { z } from "zod";
import { getMyInfoCached } from "./resolve.js";

export const getMyInfoShape = {};
export const getMyInfoSchema = z.object(getMyInfoShape).strict();

export type GetMyInfoInput = z.infer<typeof getMyInfoSchema>;

export async function getMyInfo(_input: GetMyInfoInput) {
  return getMyInfoCached();
}
