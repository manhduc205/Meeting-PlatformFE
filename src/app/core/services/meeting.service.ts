import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ParticipantDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  status: 'HOST' | 'RAISING_HAND' | 'ACTIVE' | string;
}

export interface JoinMeetingRequest {
  meetingCode: string;
  meetingPassword?: string;
}

export interface JoinMeetingResponse {
  meetingCode?: string;
  userId?: string;
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

// ── Waiting Room ──────────────────────────────────────────────────────────────

export interface WaitingParticipantDto {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: 'WAITING';
}

export interface WaitingRoomActionRequest {
  action: 'APPROVE' | 'REJECT';
  userIds: string[];
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

  getAllParticipants(meetingCode: string): Observable<ParticipantDto[]> {
    return this.http.get<ParticipantDto[]>(`${this.apiUrl}/${meetingCode}/participants`);
  }

  /** GET /api/v1/meetings/{meetingCode}/participants/sidebar — active participants only */
  getSidebarParticipants(meetingCode: string): Observable<ParticipantDto[]> {
    return this.http.get<ParticipantDto[]>(`${this.apiUrl}/${meetingCode}/participants/sidebar`);
  }

  joinMeeting(request: JoinMeetingRequest): Observable<JoinMeetingResponse> {
    return this.http.post<JoinMeetingResponse>(`${this.apiUrl}/${request.meetingCode}/join`, request);
  }

  createMeeting(request: MeetingCreateRequest): Observable<MeetingCreateResponse> {
    return this.http.post<MeetingCreateResponse>(`${this.apiUrl}/create`, request);
  }

  // ── Waiting Room (Host only) ───────────────────────────────────────────────

  /** GET /api/v1/meetings/{meetingCode}/host/waiting-room */
  getWaitingRoom(meetingCode: string): Observable<WaitingParticipantDto[]> {
    return this.http.get<WaitingParticipantDto[]>(`${this.apiUrl}/${meetingCode}/host/waiting-room`);
  }

  /** POST /api/v1/meetings/{meetingCode}/host/waiting-room/action */
  processWaitingRoom(meetingCode: string, request: WaitingRoomActionRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${meetingCode}/host/waiting-room/action`, request);
  }
}
