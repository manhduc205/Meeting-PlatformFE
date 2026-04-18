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

export interface HostKnockNotification {
  type: 'NEW_KNOCK' | 'PARTICIPANT_APPROVED' | 'PARTICIPANT_REJECTED';
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
  /** Host-specific knock notifcations from waiting room */
  readonly hostKnock$: Observable<HostKnockNotification> = this._hostKnock$.asObservable();

  async connect(meetingCode: string, senderId: string): Promise<void> {
    let currentToken = await this.authService.getToken();

    this.client = new Client({
      brokerURL: 'ws://localhost:8081/ws/meeting/websocket',
      connectHeaders: {
        Authorization: `Bearer ${currentToken}`
      },
      webSocketFactory: () => {
        // SockJS fallback
        const SockJS = (window as any).SockJS;
        if (SockJS) return new SockJS(`http://localhost:8081/ws/meeting?access_token=${currentToken}`);
        return new WebSocket(`ws://localhost:8081/ws/meeting/websocket?access_token=${currentToken}`);
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
      },
      onDisconnect: () => this._connected$.next(false),
      onStompError: (frame) => console.error('[STOMP] error', frame),
    });
    this.client.activate();
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
      `/topic/meeting.${meetingCode}.commands`,
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

    // ── Host Notifications (waiting room knocks) ──────────────────────────
    // Payload: { type: 'NEW_KNOCK', userId, firstName, lastName, timestamp }
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
