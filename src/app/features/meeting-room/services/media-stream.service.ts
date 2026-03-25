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
} from 'livekit-client';
import { BehaviorSubject } from 'rxjs';
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

  private _connected$ = new BehaviorSubject<boolean>(false);
  private _participants$ = new BehaviorSubject<Participant[]>([]);
  private _localStream$ = new BehaviorSubject<MediaStream | null>(null);

  readonly connected$ = this._connected$.asObservable();
  readonly participants$ = this._participants$.asObservable();
  readonly localStream$ = this._localStream$.asObservable();

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

    // Expose local MediaStream for the "You" tile
    this._updateLocalStream();
    this._connected$.next(true);
  }

  async toggleMic(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  async toggleCamera(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setCameraEnabled(enabled);
    this._updateLocalStream();
  }

  async toggleScreenShare(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setScreenShareEnabled(enabled);
  }

  async disconnect(): Promise<void> {
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
    this._connected$.next(false);
    this._participants$.next([]);
    this._localStream$.next(null);
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
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        this._attachTrack(track, participant);
      })
      .on(RoomEvent.TrackUnsubscribed, (_track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
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
      .on(RoomEvent.LocalTrackPublished, () => {
        this._updateLocalStream();
        this._syncParticipants();
      })
      .on(RoomEvent.LocalTrackUnpublished, () => {
        this._updateLocalStream();
        this._syncParticipants();
      })
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Connected) this._connected$.next(true);
        if (state === ConnectionState.Disconnected) this._connected$.next(false);
      })
      .on(RoomEvent.Disconnected, () => {
        this._connected$.next(false);
      });
  }

  private _attachTrack(track: RemoteTrack, participant: RemoteParticipant): void {
    // Build/update participant entry with fresh stream
    const existing = this._participants$.value.find(p => p.id === participant.identity);
    if (existing) {
      const el = document.createElement(track.kind === Track.Kind.Video ? 'video' : 'audio');
      track.attach(el);
      this._syncParticipants();
    } else {
      this._syncParticipants();
    }
  }

  private _syncParticipants(): void {
    const remotes: Participant[] = Array.from(this.room.remoteParticipants.values()).map(rp => {
      // Collect video stream
      const videoTrack = rp.getTrackPublication(Track.Source.Camera)?.videoTrack;
      const stream = videoTrack ? videoTrack.mediaStream ?? undefined : undefined;

      return {
        id: rp.identity,
        name: rp.name || rp.identity,
        initials: initialsFor(rp.name || rp.identity),
        avatarColor: colorFor(rp.identity),
        isMuted: !rp.isMicrophoneEnabled,
        isCameraOn: rp.isCameraEnabled,
        isHost: rp.permissions?.canPublish ?? false,
        isSpeaking: rp.isSpeaking,
        isHandRaised: false,
        stream,
        audioLevel: rp.audioLevel,
        connectionState: 'connected',
      } satisfies Participant;
    });

    this._participants$.next(remotes);
  }

  // ─── Local stream helpers ─────────────────────────────────────────────────

  private _updateLocalStream(): void {
    const lp: LocalParticipant = this.room.localParticipant;
    const videoTrack = lp.getTrackPublication(Track.Source.Camera)?.track as LocalTrack | undefined;
    const stream = videoTrack?.mediaStream ?? null;
    this._localStream$.next(stream);
  }

  // ─── Token fetch + scheduled refresh ─────────────────────────────────────

  private async _fetchJoinInfo(code: string): Promise<MediaJoinResponse> {
    // The HttpClient already injects the Bearer token automatically
    // via the includeBearerTokenInterceptor configured in app.config.ts
    return firstValueFrom(
      this.http.get<MediaJoinResponse>(
        `http://localhost:8081/api/v1/media/join/${code}`
      )
    );
  }

  /** Parse JWT exp claim (no external lib needed) and schedule a refresh 5 min before expiry */
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
            // LiveKit SDK supports live token updates
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
