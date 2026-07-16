import { z } from "zod";
import { pumbleRequest } from "../pumbleClient.js";
import { listUsers } from "./listUsers.js";
import { listChannels } from "./listChannels.js";

export const searchMessagesShape = {
  text: z.string().optional().describe("Text to search for"),
  fromUser: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("User names, emails, or IDs to search from"),
  inChannel: z.union([z.string(), z.array(z.string())]).optional().transform(v => typeof v === 'string' ? [v] : v).describe("Channel names or IDs to search in"),
};

export const searchMessagesSchema = z.object(searchMessagesShape).refine(
  (data) => Boolean(data.text) || (data.fromUser && data.fromUser.length > 0) || (data.inChannel && data.inChannel.length > 0),
  { message: "At least one of 'text', 'fromUser', or 'inChannel' must be provided." }
);

export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;

export async function searchMessages(input: SearchMessagesInput) {
  let resolvedFrom: string[] | undefined = undefined;
  let resolvedIn: string[] | undefined = undefined;

  // Resolve users
  if (input.fromUser && input.fromUser.length > 0) {
    resolvedFrom = [];
    let usersList: any[] | null = null;
    
    for (const identifier of input.fromUser) {
      // Very basic heuristic: if it contains a space or @, it's definitely not an ID (IDs are 24-char hex strings)
      // Or if it doesn't look like a 24 character hex string
      const isLikelyId = /^[0-9a-fA-F]{24}$/.test(identifier);
      
      if (isLikelyId) {
        resolvedFrom.push(identifier);
      } else {
        if (!usersList) {
          usersList = await listUsers({});
        }
        
        const lowerIdentifier = identifier.toLowerCase();
        const matchedUser = usersList.find(u => 
          (u.name && u.name.toLowerCase() === lowerIdentifier) || 
          (u.email && u.email.toLowerCase() === lowerIdentifier)
        );
        
        if (matchedUser) {
          resolvedFrom.push(matchedUser.id);
        } else {
          // If we couldn't resolve it, we just pass the original string through
          // Pumble will reject it with a clean error, which is fine
          resolvedFrom.push(identifier);
        }
      }
    }
  }

  // Resolve channels
  if (input.inChannel && input.inChannel.length > 0) {
    resolvedIn = [];
    let channelsList: any[] | null = null;
    
    for (const identifier of input.inChannel) {
      const isLikelyId = /^[0-9a-fA-F]{24}$/.test(identifier);
      
      if (isLikelyId) {
        resolvedIn.push(identifier);
      } else {
        if (!channelsList) {
          channelsList = await listChannels({});
        }
        
        const lowerIdentifier = identifier.toLowerCase();
        const matchedChannel = channelsList.find(c => 
          c.channel && c.channel.name && c.channel.name.toLowerCase() === lowerIdentifier
        );
        
        if (matchedChannel && matchedChannel.channel) {
          resolvedIn.push(matchedChannel.channel.id);
        } else {
          resolvedIn.push(identifier);
        }
      }
    }
  }

  return pumbleRequest<unknown[]>("/searchMessages", {
    method: "POST",
    body: {
      text: input.text,
      ...(resolvedFrom && resolvedFrom.length > 0 ? { from: resolvedFrom } : {}),
      ...(resolvedIn && resolvedIn.length > 0 ? { in: resolvedIn } : {})
    },
  });
}
