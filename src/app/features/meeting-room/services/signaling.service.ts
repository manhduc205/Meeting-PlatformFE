import { Injectable, inject } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { HostControlService } from './host-control.service';
import { MeetingActionService } from './meeting-action.service';
import { PollService } from './poll.service';
import { HostCommandPayload } from '../models/meeting.types';
import { RaisedHandSocketPayload } from '../models/meeting.types';
import { PollSocketPayload } from '../models/meeting.types';
import { environment } from '../../../../environments/environment';

export interface HostKnockNotification {
  type: 'NEW_KNOCK' | 'PARTICIPANT_APPROVED' | 'PARTICIPANT_REJECTED' | 'WAITING_ROOM_UPDATE';
  /** For WAITING_ROOM_UPDATE: the action the host took */
  action?: 'APPROVE' | 'REJECT';
  userId: string;
  firstName: string;
  lastName: string;
  timestamp?: string;
}

/** Matches the backend SignalingMessage DTO */
export interface SignalingMessage {
  category: 'PRESENCE' | 'SIGNALING' | 'ACTION';
  type: string;
  senderId: string;
  targetId?: string;
  meetingCode: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

@Injectable({ providedIn: 'root' })
export class SignalingService {
  private client!: Client;
  private subscriptions: StompSubscription[] = [];

  private _connected$ = new BehaviorSubject<boolean>(false);
  private _presence$ = new Subject<SignalingMessage>();
  private _actions$ = new Subject<SignalingMessage>();
  private _hostKnock$ = new Subject<HostKnockNotification>();
  /** Fires whenever the server signals that the participant count changed (user approved/rejected from waiting room) */
  private _participantsChanged$ = new Subject<{ type: string }>();

  private authService = inject(AuthService);
  // Lazy inject to avoid circular deps — these are set BEFORE first subscription
  private hostControl = inject(HostControlService);
  private meetingAction = inject(MeetingActionService);
  private pollService = inject(PollService);

  /** Emits true once STOMP is fully connected */
  readonly connected$ = this._connected$.asObservable();
  /** Room-wide presence events (JOIN, LEAVE, USER_LIST_SYNC, RECONNECTING) */
  readonly presence$: Observable<SignalingMessage> = this._presence$.asObservable();
  /** Room-wide action events (CHAT, MEETING_ENDED, …) */
  readonly actions$: Observable<SignalingMessage> = this._actions$.asObservable();
  /** Host-specific knock notifications from waiting room */
  readonly hostKnock$: Observable<HostKnockNotification> = this._hostKnock$.asObservable();
  /** Fires when backend signals a participant count change (approve/reject from waiting room) */
  readonly participantsChanged$: Observable<{ type: string }> = this._participantsChanged$.asObservable();

  async connect(meetingCode: string, senderId: string): Promise<void> {
    let currentToken = await this.authService.getToken();

    await new Promise<void>((resolve, reject) => {
      this.client = new Client({
      brokerURL: `${environment.backendApiUrl.replace('http', 'ws')}/ws/meeting/websocket`,
      connectHeaders: {
        Authorization: `Bearer ${currentToken}`
      },
      webSocketFactory: () => {
        // SockJS fallback
        const SockJS = (window as any).SockJS;
        if (SockJS) return new SockJS(`${environment.backendApiUrl}/ws/meeting?access_token=${currentToken}`);
        return new WebSocket(`${environment.backendApiUrl.replace('http', 'ws')}/ws/meeting/websocket?access_token=${currentToken}`);
      },
      // Exponential backoff: 1s → 2s → 4s → … up to 30 s
      reconnectDelay: 1000,
      beforeConnect: () => {
        return new Promise<void>(async (resolve) => {
          currentToken = await this.authService.getToken();
          this.client.connectHeaders = {
            Authorization: `Bearer ${currentToken}`
          };
          resolve();
        });
      },
      onConnect: () => {
        this._connected$.next(true);
        this._subscribe(meetingCode, senderId);
        resolve();
      },
      onDisconnect: () => this._connected$.next(false),
      onStompError: (frame) => {
        console.error('[STOMP] error', frame);
        reject(new Error(frame.headers['message'] || 'STOMP connection failed'));
      },
      onWebSocketError: (event) => {
        console.error('[STOMP] WebSocket error', event);
        reject(new Error('WebSocket connection failed'));
      },
      });
      this.client.activate();
    });
  }

  private _subscribe(meetingCode: string, senderId: string): void {
    // Xoá toàn bộ đăng ký cũ để tránh trùng lặp sự kiện khi reconnect
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];

    // ── Room broadcast (chat, presence, etc.) ────────────────────────────────
    const roomSub = this.client.subscribe(
      `/topic/meeting.${meetingCode}`,
      (msg: IMessage) => {
        const body: SignalingMessage = JSON.parse(msg.body);
        if (body.category === 'PRESENCE') this._presence$.next(body);
        if (body.category === 'ACTION') this._actions$.next(body);
      }
    );
    this.subscriptions.push(roomSub);

    // ── Host Commands topic ───────────────────────────────────────────────────
    // Payload: { action: 'MUTE_ALL' | 'KICK' | 'SETTING_CHANGED', ... }
    const cmdSub = this.client.subscribe(
      `/topic/meeting.${meetingCode}.host-commands`,
      (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body) as HostCommandPayload;
          this.hostControl.dispatch(payload);
        } catch (e) {
          console.warn('[STOMP] Failed to parse commands payload', e);
        }
      }
    );
    this.subscriptions.push(cmdSub);

    // ── Raised Hands topic ────────────────────────────────────────────────────
    // Payload: { action: 'RAISE', data: ParticipantDto } | { action: 'LOWER', userId: string }
    const handSub = this.client.subscribe(
      `/topic/meeting.${meetingCode}.raised-hands`,
      (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body) as RaisedHandSocketPayload;
          this.meetingAction.dispatch(payload);
        } catch (e) {
          console.warn('[STOMP] Failed to parse raised-hands payload', e);
        }
      }
    );
    this.subscriptions.push(handSub);

    // ── Polls topic ────────────────────────────────────────────────────────
    // Payload: POLL_CREATED | VOTE_UPDATED | POLL_CLOSED
    const pollSub = this.client.subscribe(
      `/topic/meeting.${meetingCode}.polls`,
      (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body) as PollSocketPayload;
          this.pollService.dispatch(payload);
        } catch (e) {
          console.warn('[STOMP] Failed to parse polls payload', e);
        }
      }
    );
    this.subscriptions.push(pollSub);

    // ── Host Notifications (waiting room knocks + approve/reject updates) ──
    // NEW backend also sends: { type: 'WAITING_ROOM_UPDATE', action: 'APPROVE'|'REJECT', userId: '...' }
    const knockSub = this.client.subscribe(
      `/topic/meeting.${meetingCode}.host-notifications`,
      (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body) as HostKnockNotification;
          this._hostKnock$.next(payload);
        } catch (e) {
          console.warn('[STOMP] Failed to parse host-notifications payload', e);
        }
      }
    );
    this.subscriptions.push(knockSub);

    // ── Participants Changed topic (approve/reject triggers sidebar refresh) ──
    // Fired by backend after processWaitingParticipants to signal all clients
    const pChangedSub = this.client.subscribe(
      `/topic/meeting.${meetingCode}.participants-changed`,
      (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body);
          this._participantsChanged$.next(payload);
        } catch (e) {
          console.warn('[STOMP] Failed to parse participants-changed payload', e);
        }
      }
    );
    this.subscriptions.push(pChangedSub);

    // ── Send JOIN presence ────────────────────────────────────────────────────
    this.sendMessage({
      category: 'PRESENCE',
      type: 'JOIN',
      senderId,
      meetingCode,
      payload: {},
      timestamp: new Date().toISOString(),
    });
  }

  sendMessage(msg: SignalingMessage): void {
    if (!this.client?.connected) return;
    this.client.publish({
      destination: '/app/meeting.signal',
      body: JSON.stringify(msg),
    });
  }

  /** Send a CHAT action to the room */
  sendChat(meetingCode: string, senderId: string, text: string): void {
    this.sendMessage({
      category: 'ACTION',
      type: 'CHAT',
      senderId,
      meetingCode,
      payload: { text },
      timestamp: new Date().toISOString(),
    });
  }

  /** Send LEAVE presence */
  sendLeave(meetingCode: string, senderId: string): void {
    this.sendMessage({
      category: 'PRESENCE',
      type: 'LEAVE',
      senderId,
      meetingCode,
      payload: {},
      timestamp: new Date().toISOString(),
    });
  }

  disconnect(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];
    if (this.client?.active) this.client.deactivate();
    this._connected$.next(false);
  }
}
