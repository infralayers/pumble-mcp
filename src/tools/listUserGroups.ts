import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const listUserGroupsShape = {};
export const listUserGroupsSchema = z.object(listUserGroupsShape);

export type ListUserGroupsInput = z.infer<typeof listUserGroupsSchema>;

export async function listUserGroups(_input: ListUserGroupsInput) {
  return pumbleRequest<unknown[]>("/listUserGroups", { method: "GET" });
}
