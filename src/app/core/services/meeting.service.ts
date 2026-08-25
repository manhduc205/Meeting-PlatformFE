import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ParticipantDto {
  id: string;
  email?: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  avatarUrl: string | null;
  status: 'HOST' | 'RAISING_HAND' | 'ACTIVE' | string;
  isMe?: boolean;     // true nếu đây là người dùng hiện tại (từ /sidebar API)
  joinedAt?: string;  // ISO timestamp (từ /sidebar API)
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
  plannedStartTime: string;
  plannedEndTime: string;
  inviteeEmails?: string[];
  meetingPassword?: string;
  isWaitingRoomEnabled?: boolean;
}

export interface InstantMeetingCreateRequest {
  title: string;
  description?: string;
  inviteeEmails?: string[];
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
  plannedStartTime: string;
  plannedEndTime: string;
  startedAt?: string;
  endedAt?: string;
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

export interface MeetingResponse {
  id: string;
  meetingCode: string;
  title: string;
  status: string;
  plannedEndTime?: string;
}

export interface CalendarMeetingResponse {
  id: string;
  meetingCode: string;
  title: string;
  description?: string;
  hostId: string;
  hostName?: string;
  hostAvatarUrl?: string;
  plannedStartTime: string;
  plannedEndTime: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED';
  isHost?: boolean;
  role: 'HOST' | 'GUEST';
  invitationStatus?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  canStart: boolean;
  canJoin: boolean;
}

export interface InvitationResponse {
  id: string;
  inviteeEmail: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  respondedAt?: string;
  createdAt: string;
}

export interface InvitationCreateRequest {
  inviteeEmails: string[];
}

// ── Waiting Room ──────────────────────────────────────────────────────────────

/** Shape returned by GET /host/waiting-room */
export interface WaitingParticipantDto {
  id: string;
  fullName: string;       // API trả về fullName
  firstName?: string;     // optional fallback
  lastName?: string;
  avatarUrl: string | null;
  status: 'WAITING' | string;
  isMe: boolean | null;
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
    return this.http.post<MeetingCreateResponse>(this.apiUrl, request);
  }

  createInstantMeeting(request: InstantMeetingCreateRequest): Observable<MeetingCreateResponse> {
    return this.http.post<MeetingCreateResponse>(`${this.apiUrl}/instant`, request);
  }

  getCalendar(from: string, to: string): Observable<CalendarMeetingResponse[]> {
    return this.http.get<CalendarMeetingResponse[]>(`${environment.backendApiUrl}/api/v1/me/calendar`, { params: { from, to } });
  }

  getUpcoming(limit = 10): Observable<CalendarMeetingResponse[]> {
    return this.http.get<CalendarMeetingResponse[]>(`${environment.backendApiUrl}/api/v1/me/upcoming`, { params: { limit } });
  }

  startMeeting(meetingCode: string): Observable<MeetingCreateResponse> {
    return this.http.post<MeetingCreateResponse>(`${this.apiUrl}/${meetingCode}/start`, {});
  }

  getInvitations(meetingCode: string): Observable<InvitationResponse[]> {
    return this.http.get<InvitationResponse[]>(`${this.apiUrl}/${meetingCode}/invitations`);
  }

  addInvitations(meetingCode: string, request: InvitationCreateRequest): Observable<InvitationResponse[]> {
    return this.http.post<InvitationResponse[]>(`${this.apiUrl}/${meetingCode}/invitations`, request);
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

  /** POST /api/v1/meetings/{meetingCode}/leave — rời phòng (không kết thúc meeting) */
  leaveMeeting(meetingCode: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${meetingCode}/leave`, {});
  }

  /** PUT /api/v1/meetings/{meetingCode}/end — kết thúc meeting (host only) */
  endMeeting(meetingCode: string): Observable<MeetingResponse> {
    return this.http.put<MeetingResponse>(`${this.apiUrl}/${meetingCode}/end`, {});
  }
}
