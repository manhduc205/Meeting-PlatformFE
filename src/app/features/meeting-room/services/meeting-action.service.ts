// ============================================================
// meeting-action.service.ts
// REST calls + STOMP subscription cho Raise Hand feature
// ============================================================
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  RaisedHandsResponse,
  RaisedHandSocketPayload,
} from '../models/meeting.types';

@Injectable({ providedIn: 'root' })
export class MeetingActionService {
  private http = inject(HttpClient);

  private readonly baseUrl = environment.backendApiUrl;

  // ── Internal Subject for raised-hand WebSocket events ─────────────────────
  private _raisedHands$ = new Subject<RaisedHandSocketPayload>();
  /** Observable emitting RAISE / LOWER events from WebSocket */
  readonly raisedHands$ = this._raisedHands$.asObservable();

  // ──────────────────────────────────────────────────────────────────────────
  // REST API calls
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/meetings/{meetingCode}/actions/raise-hand?isRaising={boolean}
   * Response: 200 OK (no body)
   */
  toggleRaiseHand(meetingCode: string, isRaising: boolean): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/api/v1/meetings/${meetingCode}/actions/raise-hand`,
      null,
      { params: { isRaising: String(isRaising) } }
    );
  }

  /**
   * GET /api/v1/meetings/{meetingCode}/actions/raised-hands
   * Returns initial list of all participants who have raised their hand.
   * Called ONCE on room join — never called again on WebSocket delta updates.
   */
  getRaisedHands(meetingCode: string): Observable<RaisedHandsResponse> {
    return this.http.get<RaisedHandsResponse>(
      `${this.baseUrl}/api/v1/meetings/${meetingCode}/actions/raised-hands`
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STOMP event dispatch — called by SignalingService when a message arrives
  // on /topic/meeting.{meetingCode}.raised-hands
  // ──────────────────────────────────────────────────────────────────────────

  /** Called by SignalingService to push decoded raised-hand events */
  dispatch(payload: RaisedHandSocketPayload): void {
    this._raisedHands$.next(payload);
  }
}
