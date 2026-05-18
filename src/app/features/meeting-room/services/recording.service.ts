import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RecordingResponse } from '../models/recording.model';

@Injectable({ providedIn: 'root' })
export class RecordingService {
  private http = inject(HttpClient);
  private base = environment.backendApiUrl;

  startRecording(meetingCode: string): Observable<RecordingResponse> {
    return this.http.post<RecordingResponse>(
      `${this.base}/api/v1/meetings/${meetingCode}/recordings/start`,
      null
    );
  }

  stopRecording(meetingCode: string, egressId: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/api/v1/meetings/${meetingCode}/recordings/${egressId}/stop`,
      null,
      { responseType: 'text' as 'json' }
    );
  }

  getRecordings(meetingCode: string): Observable<RecordingResponse[]> {
    return this.http.get<RecordingResponse[]>(
      `${this.base}/api/v1/meetings/${meetingCode}/recordings`
    );
  }
}
