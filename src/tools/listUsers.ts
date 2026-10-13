import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const listUsersShape = {
  confirmationToken: z.string().optional().describe("One-time security confirmation token authorized by the human user."),
};
export const listUsersSchema = z.object(listUsersShape).strict();

export type ListUsersInput = z.infer<typeof listUsersSchema>;

export async function listUsers(_input: ListUsersInput) {
  return pumbleRequest<unknown[]>("/listUsers", { method: "GET" });
}
