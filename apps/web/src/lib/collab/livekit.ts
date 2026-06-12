import { AccessToken, type VideoGrant } from "livekit-server-sdk";

export interface LiveKitTokenOptions {
  canPublish: boolean;
  canSubscribe: boolean;
  ttlSeconds?: number;
}

export const DEFAULT_LIVEKIT_TOKEN_TTL_SECONDS = 60 * 60;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function mintToken(
  roomId: string,
  userId: string,
  options: LiveKitTokenOptions,
): Promise<string> {
  const token = new AccessToken(
    requireEnv("LIVEKIT_API_KEY"),
    requireEnv("LIVEKIT_API_SECRET"),
    {
      identity: userId,
      ttl: options.ttlSeconds ?? DEFAULT_LIVEKIT_TOKEN_TTL_SECONDS,
    },
  );
  const grant: VideoGrant = {
    room: roomId,
    roomJoin: true,
    canPublish: options.canPublish,
    canSubscribe: options.canSubscribe,
    canPublishData: true,
  };
  token.addGrant(grant);
  return token.toJwt();
}

export function mintObserverToken(roomId: string, observerId: string): Promise<string> {
  return mintToken(roomId, observerId, { canPublish: false, canSubscribe: true });
}
