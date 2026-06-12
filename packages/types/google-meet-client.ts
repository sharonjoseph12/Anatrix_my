import { VideoRoomProviderClient, CreateVideoRoomRequest, VideoRoom } from './video';

export class GoogleMeetClient implements VideoRoomProviderClient {
  async createRoom(req: CreateVideoRoomRequest): Promise<VideoRoom> {
    throw new Error('Not implemented');
  }
  async getStatus(roomId: string): Promise<{ status: 'live' | 'ended' | 'expired'; participantCount: number }> {
    throw new Error('Not implemented');
  }
  async endRoom(roomId: string): Promise<void> {
    throw new Error('Not implemented');
  }
}