export interface RecordingResponse {
  egressId: string;
  meetingCode: string;
  status: 'STARTING' | 'RECORDING' | 'COMPLETED' | 'FAILED';
  fileUrl?: string;
  duration?: number;
  createdAt?: string;
}
