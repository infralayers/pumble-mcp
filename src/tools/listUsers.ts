import { z } from "zod";
import { getUsersList, clearCache } from "./resolve.js";

export const listUsersShape = {};
export const listUsersSchema = z.object(listUsersShape).strict();

export type ListUsersInput = z.infer<typeof listUsersSchema>;

export function clearListUsersCache() {
  clearCache();
}

export async function listUsers(_input: ListUsersInput) {
  const users = await getUsersList();
  return users.map((u) => {
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
