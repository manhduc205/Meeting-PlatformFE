// ============================================================
// poll.service.ts
// REST API calls + STOMP dispatch cho Poll feature
// ============================================================
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  PollCreateRequest,
  PollResponse,
  PollSocketPayload,
} from '../models/meeting.types';

@Injectable({ providedIn: 'root' })
export class PollService {
  private http = inject(HttpClient);

  private readonly baseUrl = environment.backendApiUrl;

  // ── Internal Subject for poll WebSocket events ─────────────────────────────
  private _polls$ = new Subject<PollSocketPayload>();
  /** Observable emitting poll events (POLL_CREATED, VOTE_UPDATED, POLL_CLOSED) */
  readonly polls$ = this._polls$.asObservable();

  // ──────────────────────────────────────────────────────────────────────────
  // REST API calls
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/meetings/{meetingCode}/polls
   * Body: { question, options, isMultipleChoice }
   * Response: PollResponse
   */
  createPoll(meetingCode: string, request: PollCreateRequest): Observable<PollResponse> {
    return this.http.post<PollResponse>(
      `${this.baseUrl}/api/v1/meetings/${meetingCode}/polls`,
      request
    );
  }

  /**
   * POST /api/v1/meetings/{meetingCode}/polls/{pollId}/vote?optionId={optionId}
   * Response: 200 OK (no body)
   */
  submitVote(meetingCode: string, pollId: string, optionId: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/api/v1/meetings/${meetingCode}/polls/${pollId}/vote`,
      null,
      { params: { optionId } }
    );
  }

  /**
   * PUT /api/v1/meetings/{meetingCode}/polls/{pollId}/close
   * Response: 200 OK (no body)
   */
  closePoll(meetingCode: string, pollId: string): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/api/v1/meetings/${meetingCode}/polls/${pollId}/close`,
      null
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STOMP event dispatch — called by SignalingService when a message arrives
  // on /topic/meeting.{meetingCode}.polls
  // ──────────────────────────────────────────────────────────────────────────

  /** Called by SignalingService to push decoded poll events */
  dispatch(payload: PollSocketPayload): void {
    this._polls$.next(payload);
  }
}
