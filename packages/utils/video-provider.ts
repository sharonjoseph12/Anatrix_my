export type VideoProvider = 'livekit' | 'google_meet';

export function selectProvider(env: Record<string, string | undefined>): VideoProvider {
  if (env.VIDEO_PROVIDER === 'livekit' && env.LIVEKIT_API_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET) {
    return 'livekit';
  }
  return 'google_meet';
}
