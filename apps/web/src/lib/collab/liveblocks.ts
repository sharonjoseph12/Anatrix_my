import { Liveblocks } from "@liveblocks/node";

export type LiveblocksPermission = "read" | "write";

export interface LiveblocksAuthBundle {
  status: number;
  body: string;
}

function requireSecret(): string {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) throw new Error("LIVEBLOCKS_SECRET_KEY is not set");
  return secret;
}

export function getClient(): Liveblocks {
  return new Liveblocks({ secret: requireSecret() });
}

export async function getServerAuthToken(
  roomId: string,
  userId: string,
  permission: LiveblocksPermission,
): Promise<LiveblocksAuthBundle> {
  const client = getClient();
  const session = client.prepareSession(userId);
  session.allow(roomId, permission === "write" ? session.FULL_ACCESS : session.READ_ACCESS);
  const response = await session.authorize();
  return { status: response.status, body: response.body };
}

export function downgradeObserverToken(roomId: string, observerId: string): Promise<LiveblocksAuthBundle> {
  return getServerAuthToken(roomId, observerId, "read");
}
