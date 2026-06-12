import { VideoRoomProvider, VideoRoomProviderClient, DEFAULT_VIDEO_ROOM_PROVIDER } from './video';

export async function getVideoRoomClient(
  provider: VideoRoomProvider = DEFAULT_VIDEO_ROOM_PROVIDER
): Promise<VideoRoomProviderClient> {
  if (provider === 'google_meet') {
    const { GoogleMeetClient } = await import('./google-meet-client');
    return new GoogleMeetClient();
  }
  const { LiveKitClient } = await import('./livekit-client');
  return new LiveKitClient();
}
