export interface RecordingResponse {
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


