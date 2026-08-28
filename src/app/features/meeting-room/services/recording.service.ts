import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RecordingResponse, RecordingDetailResponse, TranscriptSegmentPageResponse } from '../models/recording.model';

@Injectable({ providedIn: 'root' })
export class RecordingService {
  private http = inject(HttpClient);
  private base = environment.backendApiUrl;

  // Khớp với: POST /api/v1/recordings/meeting/{meetingCode}/start
  startRecording(meetingCode: string): Observable<RecordingResponse> {
    return this.http.post<RecordingResponse>(
      `${this.base}/api/v1/recordings/meeting/${meetingCode}/start`,
      null
    ).pipe(
      map(rec => this.mapRecording(rec))
    );
  }

  // Khớp với: POST /api/v1/recordings/meeting/{meetingCode}/stop?egressId={egressId}
  stopRecording(meetingCode: string, egressId: string): Observable<void> {
    const params = new HttpParams().set('egressId', egressId);
    return this.http.post<void>(
      `${this.base}/api/v1/recordings/meeting/${meetingCode}/stop`,
      null,
      { params, responseType: 'text' as 'json' }
    );
  }

  // Khớp với: GET /api/v1/recordings/meeting/{meetingCode}
  getRecordings(meetingCode: string): Observable<RecordingResponse[]> {
    return this.http.get<RecordingResponse[]>(
      `${this.base}/api/v1/recordings/meeting/${meetingCode}`
    ).pipe(
      map(recs => this.mapRecordings(recs))
    );
  }

  // Khớp với: GET /api/v1/recordings
  getAllMyRecordings(): Observable<RecordingResponse[]> {
    return this.http.get<RecordingResponse[]>(
      `${this.base}/api/v1/recordings`
    ).pipe(
      map(recs => this.mapRecordings(recs))
    );
  }

  // Khớp với: GET /api/v1/recordings/{id}
  getRecordingDetail(id: number): Observable<RecordingDetailResponse> {
    return this.http.get<RecordingDetailResponse>(
      `${this.base}/api/v1/recordings/${id}`
    ).pipe(
      map(detail => {
        if (detail?.metadata?.videoUrl) {
          detail.metadata.videoUrl = this.rewriteMediaUrl(detail.metadata.videoUrl);
        }
        return detail;
      })
    );
  }

  // Khớp với: GET /api/v1/recordings/{id}/transcript/segments?language=&cursor=
  getTranscriptSegments(id: number, language: string, cursor: string | null): Observable<TranscriptSegmentPageResponse> {
    let params = new HttpParams().set('language', language);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<TranscriptSegmentPageResponse>(
      `${this.base}/api/v1/recordings/${id}/transcript/segments`,
      { params }
    );
  }

  private rewriteMediaUrl(url: string): string {
    if (!environment.mediaBaseUrl || !url) return url;
    try {
      const parsed = new URL(url);
      const base = new URL(environment.mediaBaseUrl);
      parsed.protocol = base.protocol;
      parsed.hostname = base.hostname;
      parsed.port = base.port;
      return parsed.toString();
    } catch {
      return url;
    }
  }

  private mapRecording(rec: RecordingResponse): RecordingResponse {
    if (rec?.fileUrl) {
      rec.fileUrl = this.rewriteMediaUrl(rec.fileUrl);
    }
    return rec;
  }

  private mapRecordings(recs: RecordingResponse[]): RecordingResponse[] {
    return (recs || []).map(r => this.mapRecording(r));
  }
}