import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const listUsersSchema = z.object({});

export type ListUsersInput = z.infer<typeof listUsersSchema>;

export async function listUsers(_input: ListUsersInput) {
  return pumbleRequest<unknown[]>("/listUsers", { method: "GET" });
}
