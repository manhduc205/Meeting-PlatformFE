import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ParticipantDto {
  id: string;
  firstName: string;
  avatarUrl: string;
}

export interface ActiveParticipantsResponse {
  totalCount: number;
  participants: ParticipantDto[];
  displayText: string;
}

export interface JoinMeetingRequest {
  meetingCode: string;
  meetingPassword?: string;
}

export interface JoinMeetingResponse {
  status: 'APPROVED' | 'WAITING' | 'REJECTED';
  message?: string;
}

export interface MeetingCreateRequest {
  title: string;
  description?: string;
  startTime?: string | null;
  meetingPassword?: string;
  isWaitingRoomEnabled?: boolean;
}

export interface MeetingCreateResponse {
  id: string;
  meetingCode: string;
  title: string;
  description: string;
  hostId: string;
  status: string;
  startTime: string;
  isWaitingRoomEnabled: boolean;
  createdAt: string;
}

export interface MeetingInfo {
  id?: number;
  meetingCode: string;
  title?: string;
  scheduledTime?: string;
  isWaitingRoomEnabled?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MeetingService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.backendApiUrl}/api/v1/meetings`;

  getMeetingInfo(meetingCode: string): Observable<MeetingInfo> {
    return this.http.get<MeetingInfo>(`${this.apiUrl}/${meetingCode}`);
  }

  getActiveParticipants(meetingCode: string): Observable<ActiveParticipantsResponse> {
    return this.http.get<ActiveParticipantsResponse>(`${this.apiUrl}/${meetingCode}/participants/active`);
  }

  joinMeeting(request: JoinMeetingRequest): Observable<JoinMeetingResponse> {
    return this.http.post<JoinMeetingResponse>(`${this.apiUrl}/${request.meetingCode}/join`, request);
  }

  createMeeting(request: MeetingCreateRequest): Observable<MeetingCreateResponse> {
    return this.http.post<MeetingCreateResponse>(`${this.apiUrl}/create`, request);
  }
}
