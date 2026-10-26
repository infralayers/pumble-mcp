import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";

export const listUsersShape = {
  confirmationToken: z.string().optional().describe("One-time security confirmation token authorized by the human user."),
};
export const listUsersSchema = z.object(listUsersShape).strict();

export type ListUsersInput = z.infer<typeof listUsersSchema>;

export async function listUsers(_input: ListUsersInput) {
  const raw = await pumbleRequest<any[]>("/listUsers", { method: "GET" });
  return (Array.isArray(raw) ? raw : []).map((u: any) => {
    const res: Record<string, any> = {
      id: u.id,
      name: u.name,
      realName: u.realName,
      email: u.email,
      status: u.status,
    };
    if (u.bot) res.isBot = true;
    return res;
  });
}
