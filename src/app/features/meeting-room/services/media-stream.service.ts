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
  VideoPresets,
  RoomConnectOptions,
  ConnectionQuality,
  DisconnectReason,
} from 'livekit-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import Keycloak from 'keycloak-js';
import { firstValueFrom } from 'rxjs';
import { Participant } from '../models/meeting.model';
import { environment } from '../../../../environments/environment';

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

/** Create a fresh Room instance with optimal settings (Zoom/Meet-level quality) */
function createRoom(): Room {
  return new Room({
    // Adaptive stream: automatically subscribes lower quality for small tiles
    adaptiveStream: true,
    // Dynacast: publisher automatically reduces quality when no subscriber is watching
    dynacast: true,
    // ── Video capture defaults — 720p for clarity ──────────────────────────
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
      facingMode: 'user',
    },
    // ── Publish defaults — VP8 + simulcast for network resilience ──────────
    publishDefaults: {
      videoCodec: 'vp8',
      // Simulcast layers so receivers get the quality their bandwidth supports
      simulcast: true,
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      // Audio: echo cancellation, noise suppression (LiveKit applies automatically)
    },
    // ── Reconnect policy — exponential backoff like Zoom ──────────────────
    reconnectPolicy: {
      nextRetryDelayInMs(context) {
        // 1s → 2s → 4s → 8s → 15s (max 5 attempts)
        if (context.retryCount >= 5) return null;
        return Math.min(1000 * Math.pow(2, context.retryCount), 15_000);
      },
    },
    stopLocalTrackOnUnpublish: true,
    disconnectOnPageLeave: true,
  });
}

/** Connection timeout in ms — if connect() doesn't resolve, throw */
const CONNECT_TIMEOUT_MS = 20_000;

@Injectable({ providedIn: 'root' })
export class MediaStreamService {
  private http = inject(HttpClient);
  private keycloak = inject(Keycloak);

  // Room is recreated on every connect() to avoid stale state / duplicate listeners
  private room!: Room;

  // ─── Public state streams ─────────────────────────────────────────────────
  private _connected$ = new BehaviorSubject<boolean>(false);
  private _reconnecting$ = new BehaviorSubject<boolean>(false);
  private _participants$ = new BehaviorSubject<Participant[]>([]);
  private _localStream$ = new BehaviorSubject<MediaStream | null>(null);
  private _screenShareStream$ = new BehaviorSubject<MediaStream | null>(null);
  private _dataReceived$ = new Subject<{ payload: DataPayload; participantIdentity: string }>();
  /**
   * Server-authoritative exits. This is deliberately separate from `connected$`:
   * temporary network loss must use LiveKit's reconnect policy, while an explicit
   * RemoveParticipant/DeleteRoom must immediately leave the meeting UI.
   */
  private _serverExit$ = new Subject<'removed' | 'meeting-ended'>();

  /**
   * isMicEnabled$ / isCameraEnabled$: Updated by every LiveKit event.
   * These are NOT the sole source of truth — MeetingStateService applies
   * optimistic updates for instant button feedback.
   */
  private _isMicEnabled$ = new BehaviorSubject<boolean>(true);
  private _isCameraEnabled$ = new BehaviorSubject<boolean>(true);
  private _isScreenSharing$ = new BehaviorSubject<boolean>(false);

  /**
   * isLocalSpeaking$: True when the LOCAL participant is an active speaker.
   * Updated in ActiveSpeakersChanged event — drives the "speaking ring" on
   * the local video tile (same behaviour as Zoom/Meet).
   */
  private _isLocalSpeaking$ = new BehaviorSubject<boolean>(false);

  readonly connected$ = this._connected$.asObservable();
  readonly reconnecting$ = this._reconnecting$.asObservable();
  readonly participants$ = this._participants$.asObservable();
  readonly localStream$ = this._localStream$.asObservable();
  readonly screenShareStream$ = this._screenShareStream$.asObservable();
  readonly dataReceived$ = this._dataReceived$.asObservable();
  readonly serverExit$ = this._serverExit$.asObservable();
  readonly isMicEnabled$ = this._isMicEnabled$.asObservable();
  readonly isCameraEnabled$ = this._isCameraEnabled$.asObservable();
  readonly isScreenSharing$ = this._isScreenSharing$.asObservable();
  readonly isLocalSpeaking$ = this._isLocalSpeaking$.asObservable();

  private meetingCode = '';
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Connect to a LiveKit room.
   * - Creates a FRESH Room instance (avoids stale listeners from prior session)
   * - Has a 20-second timeout to catch unresponsive servers quickly
   * - Refreshes Keycloak token before fetching join info (avoids 401 on expired token)
   */
  async connect(meetingCode: string): Promise<void> {
    this.meetingCode = meetingCode;

    // ── 1. Ensure fresh Keycloak token ───────────────────────────────────
    try {
      await this.keycloak.updateToken(30); // refresh if <30s validity left
    } catch {
      console.warn('[MediaStream] Could not refresh Keycloak token before join');
    }

    // ── 2. Fetch LiveKit join info ────────────────────────────────────────
    const joinInfo = await this._fetchJoinInfo(meetingCode);

    if (!joinInfo.token || !joinInfo.serverUrl) {
      throw new Error(`Backend returned ${joinInfo.mode} mode — SFU token unavailable`);
    }

    // ── 3. Tear down any previous room (idempotent) ───────────────────────
    if (this.room) {
      this.room.removeAllListeners();
      try { await this.room.disconnect(); } catch { /* ignore */ }
    }

    // ── 4. Create fresh Room + register events ─────────────────────────── 
    this.room = createRoom();
    this._registerRoomEvents();

    // ── 5. Connect with timeout guard ────────────────────────────────────
    const connectOptions: RoomConnectOptions = {
      autoSubscribe: true,
      rtcConfig: {
        iceServers: [
          { urls: joinInfo.iceServers.stunUrl },
          {
            urls: joinInfo.iceServers.turnUrl,
            username: joinInfo.iceServers.username,
            credential: joinInfo.iceServers.credential,
          },
        ].filter(server => !!server.urls),
      },
    };

    await Promise.race([
      this.room.connect(joinInfo.serverUrl, joinInfo.token, connectOptions),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LiveKit connection timed out after 20s')), CONNECT_TIMEOUT_MS)
      ),
    ]);

    // ── 6. Enable camera + mic (best-effort) ──────────────────────────────
    try {
      await this.room.localParticipant.enableCameraAndMicrophone();
    } catch (e) {
      console.warn('[MediaStream] Could not enable camera/mic — may need permission', e);
    }

    // ── 7. Sync initial state ─────────────────────────────────────────────
    this._syncLocalState();
    this._updateLocalStream();
    this._connected$.next(true);
    this._reconnecting$.next(false);

    // ── 8. Schedule token refresh ─────────────────────────────────────────
    this._scheduleTokenRefresh(joinInfo.token);
  }

  /**
   * Set mic enabled/disabled.
   * Takes an EXPLICIT boolean — never reads from SDK state to avoid races.
   */
  async setMicEnabled(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
    this._syncLocalState();
  }

  /**
   * Set camera enabled/disabled.
   * ─ Pre-emptively clears localStream$ on disable (avatar appears IMMEDIATELY).
   * ─ Restores stream from SDK track after enable.
   */
  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (!enabled) {
      // Emit null BEFORE SDK call → avatar appears instantly (no perceptible lag)
      this._localStream$.next(null);
    }
    await this.room.localParticipant.setCameraEnabled(enabled);
    // Re-sync after SDK call completes
    this._updateLocalStream();
    this._syncLocalState();
  }

  /**
   * Toggle screen share — browser picker shown automatically by LiveKit.
   */
  async setScreenShareEnabled(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setScreenShareEnabled(enabled, {
      resolution: {
        width: 1920,
        height: 1080,
        frameRate: 30,
      },
      contentHint: 'detail',
    });
    this._syncLocalState();
    this._syncParticipants();
  }

  supportsScreenShare(): boolean {
    return typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getDisplayMedia === 'function';
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
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    this._connected$.next(false);
    this._reconnecting$.next(false);
    this._participants$.next([]);
    this._localStream$.next(null);
    this._screenShareStream$.next(null);
    this._isLocalSpeaking$.next(false);
    if (this.room) {
      this.room.removeAllListeners();
      await this.room.disconnect();
    }
  }

  get localParticipantIdentity(): string {
    return this.room?.localParticipant?.identity ?? '';
  }

  get localParticipantName(): string {
    return this.room?.localParticipant?.name ?? '';
  }

  // ─── LiveKit room events ──────────────────────────────────────────────────

  private _registerRoomEvents(): void {
    this.room
      // ── Participant lifecycle ─────────────────────────────────────────────
      .on(RoomEvent.ParticipantConnected, () => this._syncParticipants())
      .on(RoomEvent.ParticipantDisconnected, () => this._syncParticipants())

      // ── Remote tracks ─────────────────────────────────────────────────────
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, _p: RemoteParticipant) => {
        if (track.source === Track.Source.ScreenShare) {
          // Build a proper MediaStream from the track for the shared screen
          const ms = track.mediaStreamTrack
            ? new MediaStream([track.mediaStreamTrack])
            : null;
          this._screenShareStream$.next(ms);
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

      // ── Track muted/unmuted ───────────────────────────────────────────────
      .on(RoomEvent.TrackMuted, (_pub: TrackPublication) => {
        this._updateLocalStream();
        this._syncLocalState();
        this._syncParticipants();
      })

      .on(RoomEvent.TrackUnmuted, (_pub: TrackPublication) => {
        this._updateLocalStream();
        this._syncLocalState();
        this._syncParticipants();
      })

      // ── Active speakers (Zoom-style: local + remote speaking detection) ───
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speakingIds = new Set(speakers.map(s => s.identity));

        // ── Track LOCAL speaking separately (drives speaking ring on own tile) ──
        const localIdentity = this.room.localParticipant?.identity;
        const isLocalSpeaking = localIdentity ? speakingIds.has(localIdentity) : false;
        this._isLocalSpeaking$.next(isLocalSpeaking);

        // ── Update remote participants speaking state ─────────────────────────
        this._participants$.next(
          this._participants$.value.map(p => ({
            ...p,
            isSpeaking: speakingIds.has(p.id),
            audioLevel: speakers.find(s => s.identity === p.id)?.audioLevel ?? 0,
          }))
        );
      })

      // ── Local track lifecycle ─────────────────────────────────────────────
      .on(RoomEvent.LocalTrackPublished, (_pub) => {
        this._updateLocalStream();
        this._syncLocalState();
        this._syncParticipants();
      })

      .on(RoomEvent.LocalTrackUnpublished, (_pub) => {
        this._updateLocalStream();
        this._syncLocalState();
        this._syncParticipants();
      })

      // ── Connection state ──────────────────────────────────────────────────
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Connected) {
          this._connected$.next(true);
          this._reconnecting$.next(false);
        }
        if (state === ConnectionState.Reconnecting) {
          this._reconnecting$.next(true);
        }
        if (state === ConnectionState.Disconnected) {
          this._connected$.next(false);
          this._reconnecting$.next(false);
        }
      })

      .on(RoomEvent.Reconnecting, () => {
        this._reconnecting$.next(true);
        console.info('[MediaStream] Room reconnecting...');
      })

      .on(RoomEvent.Reconnected, () => {
        this._reconnecting$.next(false);
        this._syncLocalState();
        this._updateLocalStream();
        this._syncParticipants();
        console.info('[MediaStream] Room reconnected successfully');
      })

      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        this._connected$.next(false);
        this._reconnecting$.next(false);

        // The media server is the fallback source of truth when STOMP is
        // unavailable. LiveKit sends these exact reasons for the server APIs
        // used by host kick/end-meeting actions.
        if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
          this._serverExit$.next('removed');
        } else if (reason === DisconnectReason.ROOM_DELETED) {
          this._serverExit$.next('meeting-ended');
        }
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
   * Read current hardware state from the LiveKit local participant
   * and push to subjects. Called after every event AND after every SDK call.
   */
  private _syncLocalState(): void {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    this._isMicEnabled$.next(lp.isMicrophoneEnabled);
    this._isCameraEnabled$.next(lp.isCameraEnabled);
    this._isScreenSharing$.next(lp.isScreenShareEnabled);
  }

  /**
   * Build the list of remote participants from the LiveKit room.
   * For each participant, prefer screen-share track over camera track.
   * Uses MediaStreamTrack to build a proper MediaStream — avoids stale
   * mediaStream references from LiveKit's internal track objects.
   */
  private _syncParticipants(): void {
    const remotes: Participant[] = Array.from(this.room.remoteParticipants.values()).map(rp => {
      // ── Prefer screen-share video, fall back to camera ─────────────────
      const screenPub = rp.getTrackPublication(Track.Source.ScreenShare);
      const camPub = rp.getTrackPublication(Track.Source.Camera);

      const screenTrack = screenPub?.videoTrack;
      const camTrack = camPub?.videoTrack;
      const activeTrack = screenTrack || camTrack;

      // Build MediaStream from raw MediaStreamTrack (more reliable than .mediaStream)
      let stream: MediaStream | undefined;
      if (activeTrack?.mediaStreamTrack) {
        // Add audio track too so remote participants can be heard in the stream
        const videoTrackObj = activeTrack.mediaStreamTrack;
        const audioPub = rp.getTrackPublication(Track.Source.Microphone);
        const audioTrackObj = audioPub?.audioTrack?.mediaStreamTrack;
        const tracks: MediaStreamTrack[] = [videoTrackObj];
        if (audioTrackObj) tracks.push(audioTrackObj);
        stream = new MediaStream(tracks);
      }

      const hasVideo = !!(activeTrack?.mediaStreamTrack);
      const isScreenSharing = rp.isScreenShareEnabled;

      return {
        id: rp.identity,
        name: rp.identity, // Overridden by MeetingStateService with fullName from backend
        initials: initialsFor(rp.identity),
        avatarColor: colorFor(rp.identity),
        isMuted: !rp.isMicrophoneEnabled,
        isCameraOn: rp.isCameraEnabled || isScreenSharing,
        isHost: false, // Overridden by MeetingStateService
        isSpeaking: rp.isSpeaking,
        isHandRaised: false,
        isScreenSharing,
        stream: hasVideo ? stream : undefined,
        audioLevel: rp.audioLevel,
        connectionState: this._mapConnectionQuality(rp.connectionQuality),
      } satisfies Participant;
    });

    this._participants$.next(remotes);
  }

  private _mapConnectionQuality(quality: ConnectionQuality): Participant['connectionState'] {
    switch (quality) {
      case ConnectionQuality.Excellent:
      case ConnectionQuality.Good: return 'connected';
      case ConnectionQuality.Poor: return 'reconnecting';
      default: return 'connected';
    }
  }

  // ─── Local stream ─────────────────────────────────────────────────────────

  /**
   * Reads the current camera track from LiveKit and emits its MediaStream.
   * Emits null when camera is off or track doesn't exist → avatar fallback.
   */
  private _updateLocalStream(): void {
    const lp: LocalParticipant = this.room?.localParticipant;
    if (!lp) {
      this._localStream$.next(null);
      return;
    }

    const camPub = lp.getTrackPublication(Track.Source.Camera);
    const videoTrack = (camPub && lp.isCameraEnabled) ? camPub.track as LocalTrack | undefined : undefined;

    // Build stream from raw MediaStreamTrack (more reliable reference)
    let stream: MediaStream | null = null;
    if (videoTrack?.mediaStreamTrack) {
      stream = new MediaStream([videoTrack.mediaStreamTrack]);
    }

    this._localStream$.next(stream);
  }

  // ─── Token fetch + scheduled refresh ─────────────────────────────────────

  private async _fetchJoinInfo(code: string): Promise<MediaJoinResponse> {
    return firstValueFrom(
      this.http.get<MediaJoinResponse>(
        `${environment.backendApiUrl}/api/v1/media/join/${code}`
      )
    );
  }

  private _scheduleTokenRefresh(jwt: string): void {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      const expiresAt = (payload.exp as number) * 1000;
      const refreshIn = expiresAt - Date.now() - 5 * 60 * 1000; // Refresh 5 min before expiry
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
