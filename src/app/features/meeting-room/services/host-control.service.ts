// ============================================================
// host-control.service.ts
// REST calls + STOMP subscription cho Host Settings & Commands
// ============================================================
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  HostSettingType,
  HostCommandType,
  HostCommandPayload,
} from '../models/meeting.types';
import { AuthService } from '../../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class HostControlService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly baseUrl = environment.backendApiUrl;

  // ── Internal Subject for decoded host command events ───────────────────────
  private _commands$ = new Subject<HostCommandPayload>();
  /** Observable emitted every time a host command is received via WebSocket */
  readonly commands$ = this._commands$.asObservable();

  // ──────────────────────────────────────────────────────────────────────────
  // REST API calls
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * PUT /api/v1/meetings/{meetingCode}/host/settings
   * type: LOCK_MEETING | WAITING_ROOM | DISABLE_SCREEN_SHARE
   * Response: 200 OK (no body)
   */
  updateSetting(
    meetingCode: string,
    type: HostSettingType,
    enabled: boolean
  ): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/api/v1/meetings/${meetingCode}/host/settings`,
      null,
      { params: { type, enabled: String(enabled) } }
    );
  }

  /**
   * POST /api/v1/meetings/{meetingCode}/host/command
   * command: MUTE_ALL | KICK_PARTICIPANT
   * Response: 200 OK (no body)
   */
  sendCommand(
    meetingCode: string,
    command: HostCommandType,
    targetId?: string
  ): Observable<void> {
    const params: Record<string, string> = { command };
    if (targetId) params['targetId'] = targetId;
    return this.http.post<void>(
      `${this.baseUrl}/api/v1/meetings/${meetingCode}/host/command`,
      null,
      { params }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STOMP event dispatch — called by SignalingService when a message arrives
  // on /topic/meeting.{meetingCode}.commands
  // ──────────────────────────────────────────────────────────────────────────

  /** Called by SignalingService to push a decoded host command payload */
  dispatch(payload: HostCommandPayload): void {
    this._commands$.next(payload);
  }
}
