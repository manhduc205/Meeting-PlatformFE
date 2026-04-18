import { Injectable, inject } from '@angular/core';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalParticipant,
  Track,
  ConnectionState,
  LocalTrack,
  TrackPublication,
} from 'livekit-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import Keycloak from 'keycloak-js';
import { firstValueFrom } from 'rxjs';
import { Participant } from '../models/meeting.model';

interface MediaJoinResponse {
  mode: 'P2P' | 'SFU';
  token: string | null;
  serverUrl: string | null;
  iceServers: {
    stunUrl: string;
    turnUrl: string;
    username: string;
    credential: string;
  };
}

export interface ReactionPayload {
  type: 'REACTION';
  emoji: string;
  senderName: string;
  senderId: string;
}

export interface WhiteboardPayload {
  type: 'WHITEBOARD_DRAW';
  tool: string;
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

export interface WhiteboardClearPayload {
  type: 'WHITEBOARD_CLEAR';
}

export type DataPayload = ReactionPayload | WhiteboardPayload | WhiteboardClearPayload;

const AVATAR_COLORS = [
  '#4f46e5', '#0ea5e9', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initialsFor(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

@Injectable({ providedIn: 'root' })
export class MediaStreamService {
  private http = inject(HttpClient);
  private keycloak = inject(Keycloak);

  private room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  // ─── Public state streams ─────────────────────────────────────────────────
  private _connected$ = new BehaviorSubject<boolean>(false);
  private _participants$ = new BehaviorSubject<Participant[]>([]);
  private _localStream$ = new BehaviorSubject<MediaStream | null>(null);
  private _screenShareStream$ = new BehaviorSubject<MediaStream | null>(null);
  private _dataReceived$ = new Subject<{ payload: DataPayload; participantIdentity: string }>();

  /**
   * These BehaviorSubjects are updated in EVERY relevant LiveKit event
   * (TrackMuted, TrackUnmuted, LocalTrackPublished, LocalTrackUnpublished).
   * They are NOT the sole source of truth for UI — the MeetingStateService
   * also applies optimistic updates for instant button feedback.
   */
  private _isMicEnabled$ = new BehaviorSubject<boolean>(true);
  private _isCameraEnabled$ = new BehaviorSubject<boolean>(true);
  private _isScreenSharing$ = new BehaviorSubject<boolean>(false);

  readonly connected$ = this._connected$.asObservable();
  readonly participants$ = this._participants$.asObservable();
  readonly localStream$ = this._localStream$.asObservable();
  readonly screenShareStream$ = this._screenShareStream$.asObservable();
  readonly dataReceived$ = this._dataReceived$.asObservable();
  readonly isMicEnabled$ = this._isMicEnabled$.asObservable();
  readonly isCameraEnabled$ = this._isCameraEnabled$.asObservable();
  readonly isScreenSharing$ = this._isScreenSharing$.asObservable();

  private meetingCode = '';
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Public API ──────────────────────────────────────────────────────────

  async connect(meetingCode: string): Promise<void> {
    this.meetingCode = meetingCode;
    const joinInfo = await this._fetchJoinInfo(meetingCode);

    if (!joinInfo.token || !joinInfo.serverUrl) {
      throw new Error(`Backend returned ${joinInfo.mode} mode — SFU token unavailable`);
    }

    this._scheduleTokenRefresh(joinInfo.token);
    this._registerRoomEvents();

    await this.room.connect(joinInfo.serverUrl, joinInfo.token);
    await this.room.localParticipant.enableCameraAndMicrophone();

    // Sync initial state after enabling camera + mic
    this._syncLocalState();
    this._connected$.next(true);
  }

  /**
   * Set mic enabled/disabled.
   * Takes an EXPLICIT boolean — never read from SDK state to avoid race conditions.
   */
  async setMicEnabled(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
    // Force sync in case the event fires late or is unreliable
    this._syncLocalState();
  }

  /**
   * Set camera enabled/disabled.
   * After the SDK call, immediately sync stream so avatar shows without delay.
   */
  async setCameraEnabled(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setCameraEnabled(enabled);
    // Force-update local stream immediately after SDK call completes
    // This is critical: TrackMuted might fire AFTER Angular renders
    this._updateLocalStream();
    this._syncLocalState();
  }

  /**
   * Toggle screen share — browser picker is shown automatically by LiveKit.
   */
  async setScreenShareEnabled(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setScreenShareEnabled(enabled);
    this._syncLocalState();
  }

  // ─── DataChannel: Reactions ───────────────────────────────────────────────

  sendReaction(emoji: string): void {
    const lp = this.room.localParticipant;
    const payload: ReactionPayload = {
      type: 'REACTION',
      emoji,
      senderId: lp.identity,
      senderName: lp.name || lp.identity,
    };
    const data = new TextEncoder().encode(JSON.stringify(payload));
    lp.publishData(data, { reliable: false });
    // Local echo so sender sees their own reaction
    this._dataReceived$.next({ payload, participantIdentity: lp.identity });
  }

  // ─── DataChannel: Whiteboard ─────────────────────────────────────────────

  sendWhiteboardDraw(payload: WhiteboardPayload): void {
    const data = new TextEncoder().encode(JSON.stringify(payload));
    this.room.localParticipant.publishData(data, { reliable: true });
  }

  sendWhiteboardClear(): void {
    const payload: WhiteboardClearPayload = { type: 'WHITEBOARD_CLEAR' };
    const data = new TextEncoder().encode(JSON.stringify(payload));
    this.room.localParticipant.publishData(data, { reliable: true });
  }

  async disconnect(): Promise<void> {
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
    this._connected$.next(false);
    this._participants$.next([]);
    this._localStream$.next(null);
    this._screenShareStream$.next(null);
    await this.room.disconnect();
  }

  get localParticipantIdentity(): string {
    return this.room.localParticipant?.identity ?? '';
  }

  get localParticipantName(): string {
    return this.room.localParticipant?.name ?? '';
  }

  // ─── LiveKit room events ──────────────────────────────────────────────────

  private _registerRoomEvents(): void {
    this.room
      .on(RoomEvent.ParticipantConnected, () => this._syncParticipants())
      .on(RoomEvent.ParticipantDisconnected, () => this._syncParticipants())

      // ── Remote tracks ──────────────────────────────────────────────────────
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, _p: RemoteParticipant) => {
        if (track.source === Track.Source.ScreenShare) {
          const el = document.createElement('video');
          track.attach(el);
          this._screenShareStream$.next(el.srcObject as MediaStream);
        }
        this._syncParticipants();
      })

      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, _p: RemoteParticipant) => {
        track.detach(); // Free RAM — critical for long meetings
        if (track.source === Track.Source.ScreenShare) {
          this._screenShareStream$.next(null);
        }
        this._syncParticipants();
      })

      // ── Track muted/unmuted (applies to both local AND remote) ─────────────
      // This is the SINGLE handler for TrackMuted/Unmuted.
      // It handles: OS mute button, hardware disconnect, programmatic toggle.
      .on(RoomEvent.TrackMuted, (_pub: TrackPublication) => {
        this._updateLocalStream();  // Camera off → stream → null → avatar shows
        this._syncLocalState();     // Update isMic/Camera enabled subjects
        this._syncParticipants();   // Update remote participants list
      })

      .on(RoomEvent.TrackUnmuted, (_pub: TrackPublication) => {
        this._updateLocalStream();
        this._syncLocalState();
        this._syncParticipants();
      })

      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speakingIds = new Set(speakers.map(s => s.identity));
        this._participants$.next(
          this._participants$.value.map(p => ({
            ...p,
            isSpeaking: speakingIds.has(p.id),
            audioLevel: speakingIds.has(p.id) ? (speakers.find(s => s.identity === p.id)?.audioLevel ?? 0) : 0,
          }))
        );
      })

      // ── Local track lifecycle ─────────────────────────────────────────────
      .on(RoomEvent.LocalTrackPublished, () => {
        this._updateLocalStream();
        this._syncLocalState();
        this._syncParticipants();
      })

      .on(RoomEvent.LocalTrackUnpublished, () => {
        this._updateLocalStream();
        this._syncLocalState();
        this._syncParticipants();
      })

      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Connected) this._connected$.next(true);
        if (state === ConnectionState.Disconnected) this._connected$.next(false);
      })

      .on(RoomEvent.Disconnected, () => {
        this._connected$.next(false);
      })

      // ── DataChannel ───────────────────────────────────────────────────────
      .on(RoomEvent.DataReceived, (rawData: Uint8Array, participant?: RemoteParticipant) => {
        try {
          const text = new TextDecoder().decode(rawData);
          const payload = JSON.parse(text) as DataPayload;
          this._dataReceived$.next({
            payload,
            participantIdentity: participant?.identity ?? 'unknown',
          });
        } catch (e) {
          console.warn('[MediaStream] Failed to parse DataChannel payload', e);
        }
      });
  }

  // ─── State sync helpers ───────────────────────────────────────────────────

  /**
   * Read current hardware state from the LiveKit participant and push to subjects.
   * Called after every event AND after every SDK call.
   */
  private _syncLocalState(): void {
    const lp = this.room.localParticipant;
    if (!lp) return;
    this._isMicEnabled$.next(lp.isMicrophoneEnabled);
    this._isCameraEnabled$.next(lp.isCameraEnabled);
    this._isScreenSharing$.next(lp.isScreenShareEnabled);
  }

  private _syncParticipants(): void {
    const remotes: Participant[] = Array.from(this.room.remoteParticipants.values()).map(rp => {
      // Ưu tiên lấy luồng ScreenShare nếu có, nếu không lấy Camera
      const screenTrack = rp.getTrackPublication(Track.Source.ScreenShare)?.videoTrack;
      const camTrack = rp.getTrackPublication(Track.Source.Camera)?.videoTrack;
      const activeVideoTrack = screenTrack || camTrack;
      const stream = activeVideoTrack ? activeVideoTrack.mediaStream ?? undefined : undefined;

      return {
        id: rp.identity,
        name: rp.identity, // Tên tạm sẽ được MeetingStateService override bằng FullName
        initials: initialsFor(rp.identity),
        avatarColor: colorFor(rp.identity),
        isMuted: !rp.isMicrophoneEnabled,
        isCameraOn: rp.isCameraEnabled || !!screenTrack, // Hiển thị Video Component nếu share màn hình
        isHost: false, // Override later by MeetingStateService
        isSpeaking: rp.isSpeaking,
        isHandRaised: false,
        isScreenSharing: rp.isScreenShareEnabled,
        stream,
        audioLevel: rp.audioLevel,
        connectionState: 'connected',
      } satisfies Participant;
    });

    this._participants$.next(remotes);
  }

  // ─── Local stream ─────────────────────────────────────────────────────────

  /**
   * Reads the current camera track from LiveKit and emits its MediaStream.
   * Emits null when camera is off or track doesn't exist — this triggers
   * the avatar fallback in VideoTileComponent.
   */
  private _updateLocalStream(): void {
    const lp: LocalParticipant = this.room.localParticipant;
    if (!lp) {
      this._localStream$.next(null);
      return;
    }

    const camPub = lp.getTrackPublication(Track.Source.Camera);
    // Track must exist AND camera must be enabled to show video
    const videoTrack = (camPub && lp.isCameraEnabled)
      ? camPub.track as LocalTrack | undefined
      : undefined;

    const stream = videoTrack?.mediaStream ?? null;
    this._localStream$.next(stream);
  }

  // ─── Token fetch + scheduled refresh ─────────────────────────────────────

  private async _fetchJoinInfo(code: string): Promise<MediaJoinResponse> {
    return firstValueFrom(
      this.http.get<MediaJoinResponse>(
        `http://localhost:8081/api/v1/media/join/${code}`
      )
    );
  }

  private _scheduleTokenRefresh(jwt: string): void {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      const expiresAt = (payload.exp as number) * 1000;
      const refreshIn = expiresAt - Date.now() - 5 * 60 * 1000;
      if (refreshIn <= 0) return;
      this.tokenRefreshTimer = setTimeout(async () => {
        try {
          const info = await this._fetchJoinInfo(this.meetingCode);
          if (info.token) {
            await (this.room as any).updateToken?.(info.token);
            this._scheduleTokenRefresh(info.token);
          }
        } catch (e) {
          console.error('[MediaStream] Token refresh failed', e);
        }
      }, refreshIn);
    } catch {
      // Ignore malformed JWT
    }
  }
}
