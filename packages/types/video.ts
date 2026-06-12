// Placeholder stub for the VideoRoomProvider interface.
// 008 (collaborative-mode) ships the full LiveKit + Google Meet implementations.
// 007 (adaptive-learning-graph) imports THIS stub; 008's later delivery swaps the impl.
// Without this stub, 007's US1 (mentor match) is blocked waiting on 008.
//
// Constitutional backing: principles II (Privacy-First), III (Cost-Aware).

export type VideoRoomProvider = 'livekit' | 'google_meet';

export interface VideoRoom {
  /** Provider that created this room. */
  provider: VideoRoomProvider;

  /** Public URL the student and mentor join. */
  joinUrl: string;

  /** Provider-internal room ID (LiveKit sid, Meet code, etc.). */
  roomId: string;

  /** ISO 8601 expiry. */
  expiresAt: string;

  /** Whether recording is enabled (recruiter-observe / mentor sessions may differ). */
  recordingEnabled: boolean;
}

export interface CreateVideoRoomRequest {
  sessionId: string;
  studentId: string;
  mentorId: string;
  scheduledStartAt: string; // ISO 8601
  durationMinutes: number;
  recordingEnabled: boolean;
}

export interface VideoRoomProviderClient {
  /** Create a room, return a join URL for both parties. */
  createRoom(req: CreateVideoRoomRequest): Promise<VideoRoom>;

  /** Fetch the live status (live, ended, expired). */
  getStatus(roomId: string): Promise<{ status: 'live' | 'ended' | 'expired'; participantCount: number }>;

  /** Tear down the room early. */
  endRoom(roomId: string): Promise<void>;
}

/**
 * Default stub: Google Meet. 007 ships behind `007_alumni_mentorship` flag with this stub.
 * 008 ships the real LiveKit client; 007 swaps the binding via a feature-flag env var.
 */
export const DEFAULT_VIDEO_ROOM_PROVIDER: VideoRoomProvider = 'google_meet';

