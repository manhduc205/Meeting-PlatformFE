import { Injectable, inject } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

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

  private authService = inject(AuthService);

  /** Emits true once STOMP is fully connected */
  readonly connected$ = this._connected$.asObservable();
  /** Room-wide presence events (JOIN, LEAVE, USER_LIST_SYNC, RECONNECTING) */
  readonly presence$: Observable<SignalingMessage> = this._presence$.asObservable();
  /** Room-wide action events (CHAT, MEETING_ENDED, …) */
  readonly actions$: Observable<SignalingMessage> = this._actions$.asObservable();

  async connect(meetingCode: string, senderId: string): Promise<void> {
    const token = await this.authService.getToken();

    this.client = new Client({
      brokerURL: 'ws://localhost:8081/ws/meeting/websocket',
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      webSocketFactory: () => {
        // SockJS fallback
        const SockJS = (window as any).SockJS;
        if (SockJS) return new SockJS(`http://localhost:8081/ws/meeting?access_token=${token}`);
        return new WebSocket(`ws://localhost:8081/ws/meeting/websocket?access_token=${token}`);
      },
      // Exponential backoff: 1s → 2s → 4s → … up to 30 s
      reconnectDelay: 1000,
      beforeConnect: () => {
        return new Promise<void>(async (resolve) => {
          const freshToken = await this.authService.getToken();
          this.client.connectHeaders = {
            Authorization: `Bearer ${freshToken}`
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
    // Room broadcast
    const roomSub = this.client.subscribe(
      `/topic/meeting.${meetingCode}`,
      (msg: IMessage) => {
        const body: SignalingMessage = JSON.parse(msg.body);
        if (body.category === 'PRESENCE') this._presence$.next(body);
        if (body.category === 'ACTION') this._actions$.next(body);
      }
    );
    this.subscriptions.push(roomSub);

    // Send JOIN
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
