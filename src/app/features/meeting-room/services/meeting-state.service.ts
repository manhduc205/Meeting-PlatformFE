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

import { MeetingService, ParticipantDto, WaitingParticipantDto } from '../../../core/services/meeting.service';
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

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

  // ── Waiting Room state (Host) ───────────────────────────────────────────────
  waitingParticipants = signal<WaitingParticipantDto[]>([]);
  /** Each knock notification pushed to host via WebSocket */
  hostKnockNotifications = signal<Array<{ id: string; firstName: string; lastName: string; userId: string; timestamp: number }>>([]);

  /**
   * Canonical list of participants who have raised their hand.
   * ─────────────────────────────────────────────────────────────────────────
   * Populated ONCE via GET on join. Delta-updated by WebSocket events:
   *   RAISE → push only (no re-fetch)
   *   LOWER → filter only (no re-fetch)
   * Angular tracks items by id via trackBy in *ngFor — zero DOM re-render on push.
   */
  raisedHandList = signal<RaisedHandParticipant[]>([]);

  /** Derived count for badge display on control bar button */
  readonly raisedHandCount = computed(() => this.raisedHandList().length);

  // ── DataChannel event streams ────────────────────────────────────────────
  readonly reaction$ = new Subject<ReactionEvent>();
  readonly whiteboardDraw$ = new Subject<WhiteboardPayload>();
  readonly whiteboardClear$ = new Subject<void>();

  readonly localParticipant = computed<Participant | null>(() => {
    const user = this.auth.getCurrentUser();
    if (!user) return null;

    // Look up avatar + full name from backend participant list for the local user
    const beInfo = this.backendParticipants().find(p => p.id === user.id);

    return {
      id: 'local',
      name: beInfo?.fullName || user.name,
      initials: (beInfo?.fullName || user.name).split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
      avatarColor: '#4f46e5',
      // Use backend avatarUrl if available, otherwise undefined (shows initials)
      avatarUrl: beInfo?.avatarUrl ?? undefined,
      isMuted: this.isMuted(),
      isCameraOn: this.isCameraOn(),
      isHost: this.isHost(),
      isSpeaking: false,
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
    
    // Ghi đè Name và cờ isHost từ dữ liệu chuẩn server
    const remotes = this.participants().map(rp => {
      const beInfo = backendData.find(b => b.id === rp.id);
      if (beInfo) {
        return {
          ...rp,
          name: beInfo.fullName || rp.name,
          avatarUrl: beInfo.avatarUrl || undefined,
          initials: beInfo.fullName ? beInfo.fullName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : rp.initials,
          isHost: beInfo.status === 'HOST'
        };
      }
      return rp;
    });

    return local ? [local, ...remotes] : remotes;
  });

  private subs = new Subscription();
  private _reactionCounter = 0;
  /**
   * When REST createPoll fails, we suppress the next incoming STOMP POLL_CREATED
   * event for a short window (5s). This prevents a ghost poll from appearing on
   * the UI if the backend broadcasts STOMP before returning the HTTP error.
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

      // Fetch chuẩn host và thông tin UUID->Name từ REST API
      this.meetingService.getAllParticipants(code).subscribe({
        next: (res) => {
          this.backendParticipants.set(res);
          const hostPart = res.find(p => p.status === 'HOST');
          if (hostPart && hostPart.id === user.id) {
            this.isHost.set(true);
            // Immediately load waiting room for host
            this.loadWaitingRoom();
          } else {
            this.isHost.set(false);
          }
        },
        error: (err: any) => console.error('Failed to load active participants on join', err)
      });

    } catch (e) {
      console.error('[Meeting] Join failed', e);
      this.connectionState.set('error');
      this.showToast('Failed to connect to meeting', 'error');
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

    // ── LiveKit hardware events — used to correct state if OS overrides ────
    // e.g. user presses hardware mute button, unplugs headset, etc.
    // These run AFTER the optimistic update, so they only matter for hardware events.
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
        if (msg.type === 'MEETING_ENDED') {
          this.showToast('The host has ended the meeting', 'info');
          this.cleanupMedia();
          this.router.navigate(['/']);
        }
      })
    );

    // ── STOMP: Presence (Để cập nhật Tên + Host khi có người vào/ra) ────────
    this.subs.add(
      this.signaling.presence$.subscribe(msg => {
        if (msg.type === 'JOIN' || msg.type === 'USER_LIST_SYNC' || msg.type === 'LEAVE') {
          this.meetingService.getAllParticipants(code).subscribe({
            next: (res) => this.backendParticipants.set(res),
            error: (err: any) => console.error('Failed to reload participants', err)
          });
        }
      })
    );

    // ── STOMP: Host Commands — /topic/meeting.{code}.commands ──────────────
    this.subs.add(
      this.hostControl.commands$.subscribe(cmd => {
        this._handleHostCommand(cmd);
      })
    );

    // ── STOMP: Raised Hands delta — /topic/meeting.{code}.raised-hands ─────
    // Performance: push/filter ONLY. NEVER re-fetch API on delta update.
    this.subs.add(
      this.meetingAction.raisedHands$.subscribe(event => {
        if (event.action === 'RAISE') {
          // Deduplication guard: only add if not already in list
          this.raisedHandList.update(list => {
            const exists = list.some(p => p.id === event.data.id);
            return exists ? list : [...list, event.data];
          });
          this.showToast(`✋ ${event.data.fullName} raised their hand`, 'info');
        } else if (event.action === 'LOWER') {
          // O(n) filter — remove the participant who lowered their hand
          this.raisedHandList.update(list =>
            list.filter(p => p.id !== event.userId)
          );
        }
      })
    );

    // ── Initial raised hands list (called ONCE on join) ────────────────────
    this._fetchInitialRaisedHands(code);

    // ── STOMP: Poll events — /topic/meeting.{code}.polls ──────────────────
    this.subs.add(
      this.pollService.polls$.subscribe(event => {
        if (event.action === 'POLL_CREATED') {
          // Guard: if the REST call for THIS session failed, swallow the stale STOMP event
          if (this._suppressNextPollCreated) {
            this._suppressNextPollCreated = false;
            if (this._suppressTimer) { clearTimeout(this._suppressTimer); this._suppressTimer = null; }
            return; // ← poll sẽ KHÔNG xuất hiện trên giao diện
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
          // Đã fix: Lấy cục newCounts từ Backend gửi về để đồng bộ chính xác tuyệt đối
          this.polls.update(list =>
            list.map(p => {
              if (p.id !== event.pollId) return p;

              let newTotal = 0;
              const updatedOptions = p.options.map(o => {
                // Parse số đếm chuẩn từ Backend (Map mới nhất), k có thì mặc định 0
                const count = parseInt((event as any).newCounts[o.id]) || 0;
                newTotal += count;
                return { ...o, voteCount: count };
              });

              return {
                ...p,
                options: updatedOptions,
                totalVotes: newTotal
              };
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

    // ── STOMP: Host Notifications — /topic/meeting.{code}.host-notifications ──
    // Host receives knock notifications when a user joins the waiting room
    this.subs.add(
      this.signaling.hostKnock$.subscribe(knock => {
        if (knock.type === 'NEW_KNOCK') {
          // Show persistent toast for the host with action buttons
          const notif = {
            id: `knock-${Date.now()}-${Math.random()}`,
            firstName: knock.firstName,
            lastName: knock.lastName,
            userId: knock.userId,
            timestamp: Date.now()
          };
          this.hostKnockNotifications.update(list => [...list, notif]);
          // Also refresh the waiting room list
          this.loadWaitingRoom();
        }
      })
    );

    // ── Load initial waiting room list for host ───────────────────────────────
    if (this.isHost()) {
      this.loadWaitingRoom();
    }
  }

  private _handleDataMessage(payload: any, participantIdentity: string): void {
    if (!payload?.type) return;
    switch (payload.type as string) {
      case 'REACTION': {
        const r = payload as ReactionPayload;
        this.reaction$.next({ emoji: r.emoji, senderName: r.senderName, senderId: r.senderId, id: ++this._reactionCounter });
        break;
      }
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
    this.connectionState.set('idle');
  }

  // ── Waiting Room Actions (Host) ─────────────────────────────────────────────

  loadWaitingRoom(): void {
    const code = this.meetingCode();
    if (!code || !this.isHost()) return;
    this.meetingService.getWaitingRoom(code).subscribe({
      next: (list) => this.waitingParticipants.set(list),
      error: (err) => console.warn('[WaitingRoom] Failed to load waiting room', err)
    });
  }

  approveWaitingUser(userId: string): void {
    const code = this.meetingCode();
    // Optimistic
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
    // Optimistic
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

  dismissKnockNotification(userId: string): void {
    this.hostKnockNotifications.update(list => list.filter(n => n.userId !== userId));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────────

  /**
   * Fetch initial raised hands ONCE on join.
   * Populates raisedHandList. Never called again — deltas come via WebSocket.
   */
  private async _fetchInitialRaisedHands(meetingCode: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.meetingAction.getRaisedHands(meetingCode)
      );
      this.raisedHandList.set(res.participants);
    } catch (e) {
      console.warn('[MeetingState] Could not fetch initial raised hands', e);
    }
  }

  /**
   * Handle commands received from /topic/meeting.{code}.commands
   * ───────────────────────────────────────────────────────────────
   * Only non-host participants need to react to MUTE_ALL and KICK.
   */
  private _handleHostCommand(cmd: import('../models/meeting.types').HostCommandPayload): void {
    const myUserId = this.auth.getCurrentUser()?.id;

    switch (cmd.action) {
      case 'MUTE_ALL': {
        // If I am NOT the host, mute my mic via LiveKit
        if (!this.isHost()) {
          this.isMuted.set(true);
          this.media.setMicEnabled(false);
          this.showToast('🔇 The host has muted everyone', 'info');
        }
        break;
      }

      case 'KICK': {
        // If targetId matches my userId, disconnect and redirect
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
        // For info only — host panel already updated optimistically
        console.log('[HostCmd] Setting changed:', cmd.type, cmd.enabled);
        break;
      }
    }
  }

  // ── Controls — Optimistic update + SDK call + rollback on error ───────────

  /**
   * Mic toggle:
   * 1. Flip isMuted signal immediately → icon changes at once
   * 2. Tell LiveKit SDK the new state
   * 3. If SDK throws, rollback the signal
   */
  async toggleMic(): Promise<void> {
    const wasМuted = this.isMuted();
    const nextEnabled = wasМuted; // if was muted, next = enable mic
    this.isMuted.set(!nextEnabled); // optimistic
    try {
      await this.media.setMicEnabled(nextEnabled);
      this.showToast(nextEnabled ? 'Microphone unmuted' : 'Microphone muted', 'info');
    } catch {
      this.isMuted.set(wasМuted); // rollback
      this.showToast('Could not toggle microphone', 'error');
    }
  }

  /**
   * Camera toggle:
   * 1. Flip isCameraOn signal immediately → avatar/video switches at once
   * 2. Clear localStream if turning off → avatar shows without waiting for event
   * 3. Tell LiveKit SDK the new state
   * 4. If SDK throws, rollback
   */
  async toggleCamera(): Promise<void> {
    const wasOn = this.isCameraOn();
    const nextOn = !wasOn;
    this.isCameraOn.set(nextOn); // optimistic

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
   * Raise/Lower Hand:
   * 1. Optimistic toggle of isHandRaised signal for instant UI
   * 2. Call REST API POST raise-hand
   * 3. Rollback on error
   */
  toggleHand(): void {
    const wasRaised = this.isHandRaised();
    const nextRaising = !wasRaised;
    this.isHandRaised.set(nextRaising); // optimistic

    this.meetingAction.toggleRaiseHand(this.meetingCode(), nextRaising).subscribe({
      next: () => {
        this.showToast(
          nextRaising ? '✋ Hand raised' : 'Hand lowered',
          'info'
        );
      },
      error: () => {
        this.isHandRaised.set(wasRaised); // rollback
        this.showToast('Could not toggle hand raise', 'error');
      },
    });
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  sendReaction(emoji: string): void {
    this.showReactions.set(false);
    this.media.sendReaction(emoji);
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
    // Optimistic: cập nhật voteCount và votedByMe ngay lập tức
    this.polls.update(prev =>
      prev.map(p => {
        if (p.id !== pollId) return p;
        
        let deltaTotal = 0;
        const newOptions = p.options.map(o => {
          let change = 0;
          if (o.id === optionId && !o.votedByMe) {
             change = 1; // Chọn option mới
          } else if (o.id !== optionId && o.votedByMe) {
             change = -1; // Bỏ chọn option cũ
          }
          if (change > 0 && !p.hasVoted) deltaTotal = 1; // Nếu vote lần đầu, tổng tăng 1. Nếu đổi vote, tổng ko đổi.
          return {
            ...o,
            votedByMe: o.id === optionId,
            voteCount: Math.max(0, (o.voteCount || 0) + change),
          };
        });

        return {
          ...p,
          hasVoted: true,
          totalVotes: Math.max(0, (p.totalVotes || 0) + deltaTotal),
          options: newOptions,
        };
      })
    );
    this.pollService.submitVote(code, pollId, optionId).subscribe({
      next: () => this.showToast('🗳️ Đã ghi nhận phiếu bầu!', 'success'),
      error: () => {
        this.showToast('Không thể gửi phiếu bầu', 'error');
      },
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
          // ARM suppress flag: nếu backend đã broadcast STOMP trước khi trả HTTP error,
          // STOMP handler sẽ bỏ qua event đó — poll sẽ không hiển thị trên UI
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
