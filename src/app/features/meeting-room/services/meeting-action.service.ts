// ============================================================
// meeting-action.service.ts
// REST calls + STOMP subscription cho Raise Hand & Reaction
// ============================================================
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  RaisedHandsResponse,
  RaisedHandSocketPayload,
} from '../models/meeting.types';
import { ParticipantDto } from '../../../core/services/meeting.service';
import { SignalingMessage } from './signaling.service';
import { AuthService } from '../../../features/auth/auth.service';

/** A single floating reaction particle on screen */
export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  isMe: boolean;  // true nếu là reaction của chính mình → hiển thị "Tôi" tô sáng
  xOffset: number;
}

@Injectable({ providedIn: 'root' })
export class MeetingActionService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly baseUrl = environment.backendApiUrl;

  // ── Internal Subject for raised-hand WebSocket events ─────────────────────
  private _raisedHands$ = new Subject<RaisedHandSocketPayload>();
  /** Observable emitting RAISE / LOWER events from WebSocket */
  readonly raisedHands$ = this._raisedHands$.asObservable();

  // ── Reaction State (Client-Side Join) ────────────────────────────────────
  /** Active floating reaction particles */
  readonly flyingReactions = signal<FloatingReaction[]>([]);

  // ──────────────────────────────────────────────────────────────────────────
  // REST API calls
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/meetings/{meetingCode}/actions/raise-hand?isRaising={boolean}
   */
  toggleRaiseHand(meetingCode: string, isRaising: boolean): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/api/v1/meetings/${meetingCode}/actions/raise-hand`,
      null,
      { params: { isRaising: String(isRaising) } }
    );
  }

  getRaisedHands(meetingCode: string): Observable<RaisedHandsResponse> {
    return this.http.get<RaisedHandsResponse>(
      `${this.baseUrl}/api/v1/meetings/${meetingCode}/actions/raised-hands`
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STOMP event dispatch handlers
  // ──────────────────────────────────────────────────────────────────────────

  /** Called by SignalingService to push decoded raised-hand events */
  dispatch(payload: RaisedHandSocketPayload): void {
    this._raisedHands$.next(payload);
  }

  /**
   * Called by MeetingStateService when receiving a REACTION ACTION from WebSocket.
   *
   * Logic hiển thị tên:
   *  - Nếu sender là chính mình → senderName = "Tôi", isMe = true (tô sáng trên màn hình mình)
   *  - Nếu sender là người khác → lookup fullName trong backendParticipants (Client-Side Join)
   */
  handleReactionFromWebSocket(message: SignalingMessage, participants: ParticipantDto[]): void {
    const senderId = message.senderId;
    const emoji = (message.payload?.['emoji'] as string) || '👍';
    const localUserId = this.auth.getCurrentUser()?.id;

    // 1. Kiểm tra xem reaction có phải của chính mình không
    const isMe = !!localUserId && senderId === localUserId;

    // 2. Xác định tên hiển thị
    let displayName: string;
    if (isMe) {
      displayName = 'Tôi'; // Màn hình của mình → hiển thị "Tôi"
    } else {
      // Tìm tên user trong danh sách đang có sẵn trên RAM (Client-Side Join)
      const user = participants.find(p => p.id === senderId);
      displayName = user
        ? (user.fullName || user.firstName || 'Ai đó')
        : 'Ai đó';
    }

    // 3. Tạo object cảm xúc để bay lên
    const newReaction: FloatingReaction = {
      id: Math.random().toString(36).substring(7),
      emoji,
      senderName: displayName,
      isMe,
      xOffset: 10 + Math.random() * 75, // Random vị trí ngang
    };

    this.flyingReactions.update(reactions => [...reactions, newReaction]);

    // 4. Tự hủy sau 2.5s khi animation kết thúc
    setTimeout(() => {
      this.flyingReactions.update(list => list.filter(r => r.id !== newReaction.id));
    }, 2500);
  }
}
