import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  RecordingDetailResponse,
  RecordingResponse,
  TranscriptSegmentPageResponse
} from '../models/recording.model';

@Injectable({ providedIn: 'root' })
export class RecordingService {
  private http = inject(HttpClient);
  private base = environment.backendApiUrl;

  startRecording(meetingCode: string): Observable<RecordingResponse> {
    return this.http.post<RecordingResponse>(
      `${this.base}/api/v1/recordings/meeting/${meetingCode}/start`,
      null
    ).pipe(
      map(rec => this.mapRecording(rec))
    );
  }

  stopRecording(meetingCode: string, egressId: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/api/v1/recordings/meeting/${meetingCode}/stop?egressId=${encodeURIComponent(egressId)}`,
      null,
      { responseType: 'text' as 'json' }
    );
  }

  getRecordings(meetingCode: string): Observable<RecordingResponse[]> {
    return this.http.get<RecordingResponse[]>(
      `${this.base}/api/v1/recordings/meeting/${meetingCode}`
    ).pipe(
      map(recs => this.mapRecordings(recs))
    );
  }

  getAllMyRecordings(): Observable<RecordingResponse[]> {
    return this.http.get<RecordingResponse[]>(
      `${this.base}/api/v1/recordings`
    ).pipe(
      map(recs => this.mapRecordings(recs))
    );
  }

  getRecordingDetail(recordingId: number): Observable<RecordingDetailResponse> {
    return this.http.get<RecordingDetailResponse>(
      `${this.base}/api/v1/recordings/${recordingId}`
    ).pipe(
      map(detail => ({
        ...detail,
        metadata: {
          ...detail.metadata,
          videoUrl: this.mapFileUrl(detail.metadata.videoUrl)
        }
      }))
    );
  }

  getTranscriptSegments(
    recordingId: number,
    language: string,
    cursor?: string | null,
    limit = 100
  ): Observable<TranscriptSegmentPageResponse> {
    const params: Record<string, string> = { language, limit: String(limit) };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<TranscriptSegmentPageResponse>(
      `${this.base}/api/v1/recordings/${recordingId}/transcript`,
      { params }
    );
  }

  private mapRecording(rec: RecordingResponse): RecordingResponse {
    return { ...rec, fileUrl: this.mapFileUrl(rec.fileUrl) };
  }

  private mapRecordings(recs: RecordingResponse[]): RecordingResponse[] {
    return (recs || []).map(r => this.mapRecording(r));
  }

  private mapFileUrl(url: string | null): string | null {
    return url ? url.replace('://minio:', '://localhost:') : null;
  }
}
