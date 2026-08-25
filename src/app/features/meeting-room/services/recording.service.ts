import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RecordingResponse } from '../models/recording.model';

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
      `${this.base}/api/v1/recordings/meeting/${meetingCode}/stop`,
      null,
      { params: { egressId }, responseType: 'text' as 'json' }
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

  private mapRecording(rec: RecordingResponse): RecordingResponse {
    if (rec && rec.fileUrl) {
      // Replace internal docker network hostname 'minio' with 'localhost' for client access
      rec.fileUrl = rec.fileUrl.replace('://minio:', '://localhost:');
    }
    return rec;
  }

  private mapRecordings(recs: RecordingResponse[]): RecordingResponse[] {
    return (recs || []).map(r => this.mapRecording(r));
  }
}
