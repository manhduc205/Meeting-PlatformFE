export interface RecordingResponse {
  id?: number;
  egressId: string;
  meetingCode: string;
  recordingName: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  status: 'STARTING' | 'RECORDING' | 'COMPLETED' | 'FAILED';
  visibility: 'PRIVATE' | 'MEETING_MEMBERS' | 'LINK_ONLY' | 'PUBLIC';
  shareToken?: string | null;
  fileUrl: string | null;
  duration: number;
  createdAt: string;
}

export interface RecordingDetailResponse {
  id: number;
  egressId: string;
  status: 'STARTING' | 'RECORDING' | 'COMPLETED' | 'FAILED';
  visibility: 'PRIVATE' | 'MEETING_MEMBERS' | 'LINK_ONLY' | 'SELECTED_USERS';
  title: string;
  author: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  metadata: {
    createdAt: string;
    durationSeconds: number | null;
    videoUrl: string | null;
    storagePrefix: string | null;
  };
  ai: {
    transcriptStatus: AiContentStatus;
    summaryStatus: AiContentStatus;
    sourceLanguage: string | null;
    summary: string | null;
    keyMoments: RecordingKeyMoment[];
  };
  transcript: {
    status: AiContentStatus;
    language: string | null;
    totalSegments: number;
  };
}

export type AiContentStatus = 'NOT_REQUESTED' | 'REQUESTED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface RecordingKeyMoment {
  startMs: number;
  endMs: number | null;
  topic: string;
}

export interface TranscriptSegment {
  id: string;
  sequence: number;
  startMs: number;
  endMs: number;
  speakerId: string | null;
  speakerName: string | null;
  text: string;
  confidence: number | null;
}

export interface TranscriptSegmentPageResponse {
  items: TranscriptSegment[];
  nextCursor: string | null;
  hasNext: boolean;
}
