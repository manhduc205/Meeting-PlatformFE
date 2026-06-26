import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription, Observable } from 'rxjs';
import { Participant, ChatMessage, Poll, SidebarTab } from '../models/meeting.model';
import { RaisedHandParticipant } from '../models/meeting.types';
import { SignalingService } from './signaling.service';
import { MediaStreamService, ReactionPayload, WhiteboardPayload, WhiteboardClearPayload } from './media-stream.service';
import { AuthService } from '../../auth/auth.service';
import { HostControlService } from './host-control.service';
import { MeetingActionService } from './meeting-action.service';
import { PollService } from './poll.service';
import { PollCreateRequest } from '../models/meeting.types';
import { firstValueFrom } from 'rxjs';
import { RecordingService } from './recording.service';

import { MeetingService, ParticipantDto, WaitingParticipantDto } from '../../../core/services/meeting.service';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface ReactionEvent {
  emoji: string;
  senderName: string;
  senderId: string;
  id: number;
}

@Injectable({ providedIn: 'root' })
export class MeetingStateService {
  private signaling = inject(SignalingService);
  private media = inject(MediaStreamService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private hostControl = inject(HostControlService);
  private meetingAction = inject(MeetingActionService);
  private pollService = inject(PollService);
  private meetingService = inject(MeetingService);
  private recordingService = inject(RecordingService);

  // ── Core meeting info ────────────────────────────────────────────────────
  meetingCode = signal('');
  meetingTitle = signal('Meeting');
  connectionState = signal<ConnectionState>('idle');

  // ── Local media state — optimistic update + event confirmation ────────────
  /**
   * Strategy: update signals IMMEDIATELY when button is pressed (optimistic),
   * then confirm/correct via LiveKit events. This gives instant visual feedback.
   * The event subscriptions also handle OS-level changes (hardware mute button).
   */
  isMuted = signal(false);       // true = mic OFF
  isCameraOn = signal(true);     // true = camera ON
  isScreenSharing = signal(false);

  /**
   * isCameraToggling: true while setCameraEnabled() SDK call is in flight.
   * Prevents double-click and shows loading state on the control bar button.
   */
  isCameraToggling = signal(false);

  /**
   * isLocalSpeaking: true when the local participant is an active speaker.
   * Driven by LiveKit's ActiveSpeakersChanged event via media.isLocalSpeaking$.
   * This powers the green speaking ring on the local video tile (Zoom behaviour).
   */
  isLocalSpeaking = signal(false);

  // ── Other UI signals ─────────────────────────────────────────────────────
  participants = signal<Participant[]>([]);
  backendParticipants = signal<ParticipantDto[]>([]);
  layoutMode = signal<'speaker' | 'gallery' | 'dynamic' | 'multi'>('dynamic');
  isHandRaised = signal(false);         // true = local user has hand up
  isHost = signal(false);               // true = local user is the meeting host
  sidebarTab = signal<SidebarTab | null>(null);
  messages = signal<ChatMessage[]>([]);
  unreadMessages = signal(0);
  polls = signal<Poll[]>([]);
  showWhiteboard = signal(false);
  showAIPanel = signal(false);
  showHostTools = signal(false);
  showReactions = signal(false);
  showRaisedHands = signal(false);      // Raised Hands panel visibility
  hasLeft = signal(false);
  toastMessage = signal<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  localStream = signal<MediaStream | null>(null);

  // ── Recording state ──────────────────────────────────────────────────────
  isRecording = signal(false);
  currentEgressId = signal<string | null>(null);
  recordingDuration = signal(0);   // seconds elapsed
  private _recordingTimer: ReturnType<typeof setInterval> | null = null;

  // ── Waiting Room state (Host) ──────────────────────────────────────────────
  waitingParticipants = signal<WaitingParticipantDto[]>([]);
  /** Each knock notification pushed to host via WebSocket */
  hostKnockNotifications = signal<Array<{ id: string; firstName: string; lastName: string; userId: string; timestamp: number }>>([]);
  private _waitingRoomPollTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Canonical list of participants who have raised their hand.
   */
  raisedHandList = signal<RaisedHandParticipant[]>([]);

  /** Derived count for badge display on control bar button */
  readonly raisedHandCount = computed(() => this.raisedHandList().length);

  // ── DataChannel event streams ────────────────────────────────────────────
  readonly whiteboardDraw$ = new Subject<WhiteboardPayload>();
  readonly whiteboardClear$ = new Subject<void>();

  /**
   * localParticipant: Computed representation of the local (self) participant.
   *
   * Avatar URL priority:
   *  1. backendParticipants avatarUrl (most accurate — from our own DB)
   *  2. auth user picture (from Keycloak token — fast, available immediately)
   *  3. undefined (shows initials as last resort)
   *
   * isSpeaking: driven by isLocalSpeaking() signal (LiveKit ActiveSpeakers).
   */
  readonly localParticipant = computed<Participant | null>(() => {
    const user = this.auth.getCurrentUser();
    if (!user) return null;

    // Look up avatar + full name from backend participant list for the local user
    const beInfo = this.backendParticipants().find(p => p.id === user.id);

    // Avatar URL with multi-level fallback (backend → Keycloak picture → undefined)
    const rawAvatarUrl = beInfo?.avatarUrl ?? user.picture ?? undefined;
    const avatarUrl = rawAvatarUrl && rawAvatarUrl.trim().length > 0 ? rawAvatarUrl : undefined;

    return {
      id: 'local',
      name: beInfo?.fullName || user.name,
      initials: (beInfo?.fullName || user.name)
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      avatarColor: '#4f46e5',
      avatarUrl,
      isMuted: this.isMuted(),
      isCameraOn: this.isCameraOn(),
      isHost: this.isHost(),
      // isLocalSpeaking() drives the speaking ring on the local tile (Zoom behaviour)
      isSpeaking: this.isLocalSpeaking(),
      isHandRaised: this.isHandRaised(),
      isLocal: true,
      isScreenSharing: this.isScreenSharing(),
      // stream is null when camera is off → VideoTile shows avatar
      stream: this.isCameraOn() ? (this.localStream() ?? undefined) : undefined,
    };
  });

  readonly allParticipants = computed<Participant[]>(() => {
    const backendData = this.backendParticipants();
    const local = this.localParticipant();

    // Merge backend name/avatar/host data into remote LiveKit participants
    const remotes = this.participants().map(rp => {
      const beInfo = backendData.find(b => b.id === rp.id);
      if (beInfo) {
        const rawUrl = beInfo.avatarUrl ?? undefined;
        const avatarUrl = rawUrl && rawUrl.trim().length > 0 ? rawUrl : undefined;
        return {
          ...rp,
          name: beInfo.fullName || rp.name,
          avatarUrl,
          initials: beInfo.fullName
            ? beInfo.fullName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
            : rp.initials,
          isHost: beInfo.status === 'HOST',
        };
      }
      return rp;
    });

    return local ? [local, ...remotes] : remotes;
  });

  /**
   * screenShareParticipant: The participant currently sharing their screen.
   * Used by VideoGridComponent to switch to "Presentation Layout" (Zoom-style).
   * Priority: remote screen-sharer > local screen-sharer.
   */
  readonly screenShareParticipant = computed<Participant | null>(() => {
    // Check remote participants first (remote screen share takes priority)
    const remoteSS = this.allParticipants().find(p => !p.isLocal && p.isScreenSharing);
    if (remoteSS) return remoteSS;

    // Local user sharing
    const local = this.localParticipant();
    if (local?.isScreenSharing) return local;

    return null;
  });

  private subs = new Subscription();
  private _reactionCounter = 0;
  /**
   * When REST createPoll fails, suppress the next incoming STOMP POLL_CREATED
   * event for a short window to avoid ghost polls.
   */
  private _suppressNextPollCreated = false;
  private _suppressTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Join / Leave ─────────────────────────────────────────────────────────

  async joinMeeting(code: string, title = 'Meeting'): Promise<void> {
    this.meetingCode.set(code);
    this.meetingTitle.set(title);
    this.connectionState.set('connecting');
    this.hasLeft.set(false);

    // Reset media state
    this.isMuted.set(false);
    this.isCameraOn.set(true);
    this.isScreenSharing.set(false);
    this.isLocalSpeaking.set(false);

    const user = this.auth.getCurrentUser();
    if (!user) {
      this.connectionState.set('error');
      this.showToast('Not authenticated', 'error');
      return;
    }

    try {
      this.signaling.connect(code, user.id);
      await this.media.connect(code);
      this.connectionState.set('connected');

      // ── Strategy 1: Sidebar API for participant list + isMe → isHost detection
      this.meetingService.getSidebarParticipants(code).subscribe({
        next: (res) => {
          console.log('[Host] getSidebarParticipants response:', res);
          this.backendParticipants.set(res);
          const isHost = res.some(p => p.isMe && p.status === 'HOST');
          console.log('[Host] isHost from sidebar:', isHost, '| isMe entries:', res.filter(p => p.isMe));
          if (isHost) {
            this.isHost.set(true);
            this._startWaitingRoomPolling();
          }
        },
        error: (err: any) => console.error('[Host] getSidebarParticipants failed:', err)
      });

      // ── Strategy 2: Probe waiting-room API directly — if 200, user is the host
      // This fires independently of Strategy 1, so even if sidebar isMe is null,
      // the host UI still appears.
      this.meetingService.getWaitingRoom(code).subscribe({
        next: (list) => {
          console.log('[Host] Waiting room probe SUCCESS → user IS host. List:', list);
          this.waitingParticipants.set(list);
          if (!this.isHost()) {
            this.isHost.set(true);
            this._startWaitingRoomPolling();
          }
        },
        error: (err: any) => {
          // 403 = not host, any other error = network issue
          console.log('[Host] Waiting room probe result (403 = not host):', err?.status, err?.message);
        }
      });

    } catch (e) {
      console.error('[Meeting] Join failed', e);
      this.connectionState.set('error');
      this.showToast('Failed to connect to meeting. Please check your connection and try again.', 'error');
      return;
    }

    // ── Remote participants from LiveKit ──────────────────────────────────
    this.subs.add(
      this.media.participants$.subscribe(remotes => {
        this.participants.set(remotes);
      })
    );

    // ── Local stream (video for "You" tile) ───────────────────────────────
    this.subs.add(
      this.media.localStream$.subscribe(stream => {
        this.localStream.set(stream);
      })
    );

    // ── Local speaking state (drives speaking ring on local tile) ─────────
    this.subs.add(
      this.media.isLocalSpeaking$.subscribe(isSpeaking => {
        this.isLocalSpeaking.set(isSpeaking);
      })
    );

    // ── LiveKit hardware events — correct state if OS overrides UI ────────
    this.subs.add(
      this.media.isMicEnabled$.subscribe(enabled => {
        this.isMuted.set(!enabled);
      })
    );

    this.subs.add(
      this.media.isCameraEnabled$.subscribe(enabled => {
        this.isCameraOn.set(enabled);
      })
    );

    this.subs.add(
      this.media.isScreenSharing$.subscribe(sharing => {
        this.isScreenSharing.set(sharing);
      })
    );

    // ── Reconnecting state ────────────────────────────────────────────────
    this.subs.add(
      this.media.reconnecting$.subscribe(isReconnecting => {
        if (isReconnecting && this.connectionState() === 'connected') {
          this.connectionState.set('reconnecting');
          this.showToast('Connection lost. Reconnecting…', 'error');
        } else if (!isReconnecting && this.connectionState() === 'reconnecting') {
          this.connectionState.set('connected');
          this.showToast('Reconnected successfully ✓', 'success');
        }
      })
    );

    // ── DataChannel messages ──────────────────────────────────────────────
    this.subs.add(
      this.media.dataReceived$.subscribe(({ payload, participantIdentity }) => {
        this._handleDataMessage(payload, participantIdentity);
      })
    );

    // ── STOMP: chat + meeting control ─────────────────────────────────────
    this.subs.add(
      this.signaling.actions$.subscribe(msg => {
        if (msg.type === 'CHAT') {
          const chatMsg: ChatMessage = {
            id: `m-${Date.now()}-${Math.random()}`,
            senderId: msg.senderId,
            senderName: (msg.payload?.['senderName'] as string) || msg.senderId,
            text: (msg.payload?.['text'] as string) || '',
            timestamp: new Date(msg.timestamp || Date.now()),
          };
          this.messages.update(prev => [...prev, chatMsg]);
          if (this.sidebarTab() !== 'chat') {
            this.unreadMessages.update(n => n + 1);
            this.showToast(`${chatMsg.senderName}: ${chatMsg.text}`, 'info');
          }
        }
        if (msg.type === 'REACTION') {
          this.meetingAction.handleReactionFromWebSocket(msg, this.backendParticipants());
        }
        if (msg.type === 'MEETING_ENDED') {
          this.showToast('The host has ended the meeting', 'info');
          this.cleanupMedia();
          this.router.navigate(['/']);
        }
      })
    );

    // ── STOMP: Presence (update Name + Host when people join/leave) ────
    this.subs.add(
      this.signaling.presence$.subscribe(msg => {
        if (msg.type === 'JOIN' || msg.type === 'USER_LIST_SYNC' || msg.type === 'LEAVE') {
          // Event-driven: gọi /sidebar để cập nhật danh sách khi có người vào/ra
          this.meetingService.getSidebarParticipants(code).subscribe({
            next: (res) => {
              this.backendParticipants.set(res);
              // Re-derive isHost each time sidebar refreshes (in case token arrives late)
              const isHost = res.some(p => p.isMe && p.status === 'HOST');
              if (isHost && !this.isHost()) {
                this.isHost.set(true);
                this.loadWaitingRoom();
                this._startWaitingRoomPolling();
              } else if (!isHost && this.isHost()) {
                // Edge case: host role revoked
                this.isHost.set(false);
                this._stopWaitingRoomPolling();
              }
            },
            error: (err: any) => console.error('Failed to reload sidebar participants', err)
          });
        }
      })
    );

    // ── STOMP: Host Commands ───────────────────────────────────────────────
    this.subs.add(
      this.hostControl.commands$.subscribe(cmd => {
        this._handleHostCommand(cmd);
      })
    );

    // ── STOMP: Raised Hands delta ─────────────────────────────────────────
    this.subs.add(
      this.meetingAction.raisedHands$.subscribe(event => {
        if (event.action === 'RAISE') {
          this.raisedHandList.update(list => {
            const exists = list.some(p => p.id === event.data.id);
            return exists ? list : [...list, event.data];
          });
          this.showToast(`✋ ${event.data.fullName} raised their hand`, 'info');
        } else if (event.action === 'LOWER') {
          this.raisedHandList.update(list =>
            list.filter(p => p.id !== event.userId)
          );
        }
      })
    );

    // ── Initial raised hands list (called ONCE on join) ────────────────────
    this._fetchInitialRaisedHands(code);

    // ── STOMP: Poll events ─────────────────────────────────────────────────
    this.subs.add(
      this.pollService.polls$.subscribe(event => {
        if (event.action === 'POLL_CREATED') {
          if (this._suppressNextPollCreated) {
            this._suppressNextPollCreated = false;
            if (this._suppressTimer) { clearTimeout(this._suppressTimer); this._suppressTimer = null; }
            return;
          }
          const p = event.data;
          const newPoll: Poll = {
            id: p.id,
            question: p.question,
            isMultipleChoice: p.isMultipleChoice,
            status: p.status,
            options: p.options.map((o: any) => ({
              id: o.id,
              text: o.text,
              voteCount: o.voteCount || 0,
              votedByMe: o.votedByMe || false,
            })),
            hasVoted: p.hasVoted || false,
            totalVotes: (p as any).totalVotes || 0,
          };
          this.polls.update(list => [...list, newPoll]);
          if (this.sidebarTab() !== 'polls') {
            this.showToast('📊 A new poll has started!', 'info');
          }
        } else if (event.action === 'VOTE_UPDATED') {
          this.polls.update(list =>
            list.map(p => {
              if (p.id !== event.pollId) return p;
              let newTotal = 0;
              const updatedOptions = p.options.map(o => {
                const count = parseInt((event as any).newCounts[o.id]) || 0;
                newTotal += count;
                return { ...o, voteCount: count };
              });
              return { ...p, options: updatedOptions, totalVotes: newTotal };
            })
          );
        } else if (event.action === 'POLL_CLOSED') {
          this.polls.update(list =>
            list.map(p => p.id === event.pollId ? { ...p, status: 'CLOSED' as const } : p)
          );
          this.showToast('📊 Poll has been closed', 'info');
        }
      })
    );

    // ── STOMP: Host Knock Notifications ────────────────────────────────────
    this.subs.add(
      this.signaling.hostKnock$.subscribe(knock => {
        if (knock.type === 'NEW_KNOCK') {
          const notif = {
            id: `knock-${Date.now()}-${Math.random()}`,
            firstName: knock.firstName,
            lastName: knock.lastName,
            userId: knock.userId,
            timestamp: Date.now()
          };
          this.hostKnockNotifications.update(list => [...list, notif]);
          this.loadWaitingRoom();
        }
      })
    );

    // ── Load initial waiting room list for host ───────────────────────────────────────
    // NOTE: isHost() is async (set inside getSidebarParticipants callback above).
    // The _startWaitingRoomPolling() call inside that callback handles the initial load.
  }

  private _handleDataMessage(payload: any, participantIdentity: string): void {
    if (!payload?.type) return;
    switch (payload.type as string) {
      case 'WHITEBOARD_DRAW':
        this.whiteboardDraw$.next(payload as WhiteboardPayload);
        break;
      case 'WHITEBOARD_CLEAR':
        this.whiteboardClear$.next();
        break;
    }
  }

  async cleanupMedia(): Promise<void> {
    this.subs.unsubscribe();
    this.subs = new Subscription();
    this.signaling.disconnect();
    await this.media.disconnect();
    this.localStream.set(null);
    this.participants.set([]);
    this.raisedHandList.set([]);
    this.polls.set([]);
    this.waitingParticipants.set([]);
    this.hostKnockNotifications.set([]);
    this.isHandRaised.set(false);
    this.isLocalSpeaking.set(false);
    this.connectionState.set('idle');
    this._stopRecordingTimer();
    this._stopWaitingRoomPolling();
  }

  // ── Recording actions ─────────────────────────────────────────────────────

  startRecording(): void {
    const code = this.meetingCode();
    this.recordingService.startRecording(code).subscribe({
      next: (res) => {
        this.isRecording.set(true);
        this.currentEgressId.set(res.egressId);
        this.recordingDuration.set(0);
        this._startRecordingTimer();
        this.showToast('⏺ Recording started — saving to cloud', 'success');
      },
      error: () => {
        this.showToast('Failed to start recording', 'error');
      },
    });
  }

  stopRecording(): void {
    const code = this.meetingCode();
    const egressId = this.currentEgressId();
    if (!egressId) return;
    this.recordingService.stopRecording(code, egressId).subscribe({
      next: () => {
        const saved = this._formatDuration(this.recordingDuration());
        this.isRecording.set(false);
        this.currentEgressId.set(null);
        this._stopRecordingTimer();
        this.recordingDuration.set(0);
        this.showToast(`Recording saved to cloud (${saved})`, 'info');
      },
      error: (err) => {
        console.error('Stop recording error:', err);
        this.showToast('Failed to stop recording', 'error');
      },
    });
  }

  private _startRecordingTimer(): void {
    this._stopRecordingTimer();
    this._recordingTimer = setInterval(() => {
      this.recordingDuration.update(d => d + 1);
    }, 1000);
  }

  private _stopRecordingTimer(): void {
    if (this._recordingTimer) {
      clearInterval(this._recordingTimer);
      this._recordingTimer = null;
    }
  }

  private _formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ── Waiting Room Actions (Host) ─────────────────────────────────────────────

  /** Poll the waiting room every 5 s while the host is in the meeting. */
  private _startWaitingRoomPolling(): void {
    this._stopWaitingRoomPolling(); // clear any existing timer
    this.loadWaitingRoom();          // immediate first fetch
    this._waitingRoomPollTimer = setInterval(() => {
      if (this.connectionState() === 'connected' || this.connectionState() === 'reconnecting') {
        this.loadWaitingRoom();
      }
    }, 5000);
  }

  private _stopWaitingRoomPolling(): void {
    if (this._waitingRoomPollTimer) {
      clearInterval(this._waitingRoomPollTimer);
      this._waitingRoomPollTimer = null;
    }
  }

  loadWaitingRoom(): void {
    const code = this.meetingCode();
    if (!code) return; // only guard against missing code; isHost checked by caller
    this.meetingService.getWaitingRoom(code).subscribe({
      next: (list) => this.waitingParticipants.set(list),
      error: (err) => console.warn('[WaitingRoom] Failed to load waiting room', err)
    });
  }

  approveWaitingUser(userId: string): void {
    const code = this.meetingCode();
    this.waitingParticipants.update(list => list.filter(p => p.id !== userId));
    this.dismissKnockNotification(userId);
    this.meetingService.processWaitingRoom(code, { action: 'APPROVE', userIds: [userId] }).subscribe({
      error: () => {
        this.loadWaitingRoom();
        this.showToast('Lỗi khi duyệt người dùng', 'error');
      }
    });
  }

  rejectWaitingUser(userId: string): void {
    const code = this.meetingCode();
    this.waitingParticipants.update(list => list.filter(p => p.id !== userId));
    this.dismissKnockNotification(userId);
    this.meetingService.processWaitingRoom(code, { action: 'REJECT', userIds: [userId] }).subscribe({
      error: () => {
        this.loadWaitingRoom();
        this.showToast('Lỗi khi từ chối người dùng', 'error');
      }
    });
  }

  admitAllWaiting(): void {
    const code = this.meetingCode();
    const userIds = this.waitingParticipants().map(p => p.id);
    if (userIds.length === 0) return;
    this.waitingParticipants.set([]);
    this.hostKnockNotifications.set([]);
    this.meetingService.processWaitingRoom(code, { action: 'APPROVE', userIds }).subscribe({
      next: () => this.showToast(`✅ Đã duyệt tất cả ${userIds.length} người`, 'success'),
      error: () => {
        this.loadWaitingRoom();
        this.showToast('Lỗi khi duyệt tất cả', 'error');
      }
    });
  }

  rejectAllWaiting(): void {
    const code = this.meetingCode();
    const userIds = this.waitingParticipants().map(p => p.id);
    if (userIds.length === 0) return;
    this.waitingParticipants.set([]);
    this.hostKnockNotifications.set([]);
    this.meetingService.processWaitingRoom(code, { action: 'REJECT', userIds }).subscribe({
      next: () => this.showToast(`❌ Đã từ chối ${userIds.length} người`, 'info'),
      error: () => {
        this.loadWaitingRoom();
        this.showToast('Lỗi khi từ chối tất cả', 'error');
      }
    });
  }

  dismissKnockNotification(userId: string): void {
    this.hostKnockNotifications.update(list => list.filter(n => n.userId !== userId));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────────

  private async _fetchInitialRaisedHands(meetingCode: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.meetingAction.getRaisedHands(meetingCode));
      this.raisedHandList.set(res.participants);
    } catch (e) {
      console.warn('[MeetingState] Could not fetch initial raised hands', e);
    }
  }

  private _handleHostCommand(cmd: import('../models/meeting.types').HostCommandPayload): void {
    const myUserId = this.auth.getCurrentUser()?.id;

    switch (cmd.action) {
      case 'MUTE_ALL': {
        if (!this.isHost()) {
          this.isMuted.set(true);
          this.media.setMicEnabled(false);
          this.showToast('🔇 The host has muted everyone', 'info');
        }
        break;
      }

      case 'KICK': {
        if (cmd.targetId && cmd.targetId === myUserId) {
          this.showToast('⚠️ You have been removed from the meeting', 'error');
          this.cleanupMedia().then(() => {
            this.hasLeft.set(true);
            this.router.navigate(['/']);
          });
        }
        break;
      }

      case 'SETTING_CHANGED': {
        console.log('[HostCmd] Setting changed:', cmd.type, cmd.enabled);
        break;
      }
    }
  }

  // ── Controls — Optimistic update + SDK call + rollback on error ───────────

  /**
   * Mic toggle: optimistic + SDK call + rollback.
   */
  async toggleMic(): Promise<void> {
    const wasМuted = this.isMuted();
    const nextEnabled = wasМuted;
    this.isMuted.set(!nextEnabled); // optimistic
    try {
      await this.media.setMicEnabled(nextEnabled);
      this.showToast(nextEnabled ? 'Microphone unmuted' : 'Microphone muted', 'info');
    } catch {
      this.isMuted.set(wasМuted);
      this.showToast('Could not toggle microphone', 'error');
    }
  }

  /**
   * Camera toggle:
   * 1. Flip isCameraOn + isCameraToggling signals immediately
   * 2. Clear localStream if turning off → avatar appears INSTANTLY
   * 3. Tell LiveKit SDK the new state (MediaStreamService pre-clears stream too)
   * 4. Release isCameraToggling when done
   */
  async toggleCamera(): Promise<void> {
    if (this.isCameraToggling()) return; // Prevent double-click race
    const wasOn = this.isCameraOn();
    const nextOn = !wasOn;

    this.isCameraOn.set(nextOn);      // optimistic
    this.isCameraToggling.set(true);  // disable button

    if (!nextOn) {
      // Camera going off: clear stream NOW so avatar appears immediately
      this.localStream.set(null);
    }

    try {
      await this.media.setCameraEnabled(nextOn);
      this.showToast(nextOn ? 'Camera started' : 'Camera stopped', 'info');
    } catch {
      // Rollback
      this.isCameraOn.set(wasOn);
      if (!nextOn) {
        // restore stream from SDK (camera is still on)
        // localStream will update via localStream$ subscription
      }
      this.showToast('No camera found or permission denied', 'error');
    } finally {
      this.isCameraToggling.set(false);
    }
  }

  async toggleScreenShare(): Promise<void> {
    const wasSharing = this.isScreenSharing();
    const nextSharing = !wasSharing;
    try {
      await this.media.setScreenShareEnabled(nextSharing);
      this.showToast(nextSharing ? 'Screen sharing started' : 'Screen sharing stopped', 'info');
    } catch {
      // Screen share cancelled by user (rejected picker) — not an error
    }
  }

  /**
   * Raise/Lower Hand: optimistic toggle + REST API + rollback.
   */
  toggleHand(): void {
    const wasRaised = this.isHandRaised();
    const nextRaising = !wasRaised;
    this.isHandRaised.set(nextRaising);

    this.meetingAction.toggleRaiseHand(this.meetingCode(), nextRaising).subscribe({
      next: () => {
        this.showToast(nextRaising ? '✋ Hand raised' : 'Hand lowered', 'info');
      },
      error: () => {
        this.isHandRaised.set(wasRaised);
        this.showToast('Could not toggle hand raise', 'error');
      },
    });
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  sendReaction(emoji: string): void {
    this.showReactions.set(false);
    const user = this.auth.getCurrentUser();
    if (user) {
      this.signaling.sendMessage({
        category: 'ACTION',
        type: 'REACTION',
        senderId: user.id,
        meetingCode: this.meetingCode(),
        payload: { emoji },
        timestamp: new Date().toISOString()
      });
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  sendMessage(text: string): void {
    const user = this.auth.getCurrentUser();
    if (!user) return;
    this.messages.update(prev => [
      ...prev,
      { id: `m-${Date.now()}`, senderId: 'local', senderName: user.name, text, timestamp: new Date(), isMe: true },
    ]);
    this.signaling.sendChat(this.meetingCode(), user.id, text);
  }

  // ── Leave ─────────────────────────────────────────────────────────────────

  async endCall(): Promise<void> {
    const user = this.auth.getCurrentUser();
    if (user) this.signaling.sendLeave(this.meetingCode(), user.id);
    await this.cleanupMedia();
    this.hasLeft.set(true);
    this.showToast('You have left the meeting', 'error');
  }

  async rejoin(): Promise<void> {
    this.hasLeft.set(false);
    await this.joinMeeting(this.meetingCode(), this.meetingTitle());
  }

  // ── Sidebar / UI ─────────────────────────────────────────────────────────

  toggleSidebar(tab: SidebarTab | null): void {
    this.sidebarTab.update(prev => (prev === tab ? null : tab));
    this.showHostTools.set(false);
    this.showAIPanel.set(false);
    this.showReactions.set(false);
    if (tab === 'chat') this.unreadMessages.set(0);
  }

  toggleAIPanel(): void {
    this.showAIPanel.update(v => !v);
    this.showHostTools.set(false);
    this.showReactions.set(false);
  }

  toggleHostTools(): void {
    this.showHostTools.update(v => !v);
    this.showAIPanel.set(false);
    this.showReactions.set(false);
    this.showRaisedHands.set(false);
  }

  toggleRaisedHands(): void {
    this.showRaisedHands.update(v => !v);
    this.showHostTools.set(false);
    this.showAIPanel.set(false);
    this.showReactions.set(false);
  }

  toggleReactions(): void {
    this.showReactions.update(v => !v);
    this.showAIPanel.set(false);
    this.showHostTools.set(false);
  }

  vote(pollId: string, optionId: string): void {
    const code = this.meetingCode();
    this.polls.update(prev =>
      prev.map(p => {
        if (p.id !== pollId) return p;
        let deltaTotal = 0;
        const newOptions = p.options.map(o => {
          let change = 0;
          if (o.id === optionId && !o.votedByMe) change = 1;
          else if (o.id !== optionId && o.votedByMe) change = -1;
          if (change > 0 && !p.hasVoted) deltaTotal = 1;
          return {
            ...o,
            votedByMe: o.id === optionId,
            voteCount: Math.max(0, (o.voteCount || 0) + change),
          };
        });
        return { ...p, hasVoted: true, totalVotes: Math.max(0, (p.totalVotes || 0) + deltaTotal), options: newOptions };
      })
    );
    this.pollService.submitVote(code, pollId, optionId).subscribe({
      next: () => this.showToast('🗳️ Đã ghi nhận phiếu bầu!', 'success'),
      error: () => this.showToast('Không thể gửi phiếu bầu', 'error'),
    });
  }

  createPoll(request: PollCreateRequest): Observable<void> {
    const code = this.meetingCode();
    return new Observable<void>(observer => {
      this.pollService.createPoll(code, request).subscribe({
        next: () => {
          this.showToast('📊 Poll được tạo thành công!', 'success');
          observer.next();
          observer.complete();
        },
        error: (err: any) => {
          this._suppressNextPollCreated = true;
          if (this._suppressTimer) clearTimeout(this._suppressTimer);
          this._suppressTimer = setTimeout(() => {
            this._suppressNextPollCreated = false;
            this._suppressTimer = null;
          }, 5000);
          this.showToast('Không thể tạo khảo sát', 'error');
          observer.error(err);
        },
      });
    });
  }

  closePoll(pollId: string): void {
    const code = this.meetingCode();
    this.pollService.closePoll(code, pollId).subscribe({
      next: () => this.showToast('Poll closed', 'info'),
      error: () => this.showToast('Failed to close poll', 'error'),
    });
  }

  showToast(text: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.toastMessage.set({ text, type });
    setTimeout(() => this.toastMessage.set(null), 3500);
  }
}
