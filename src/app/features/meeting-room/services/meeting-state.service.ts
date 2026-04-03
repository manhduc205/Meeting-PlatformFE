import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { Participant, ChatMessage, Poll, SidebarTab } from '../models/meeting.model';
import { SignalingService } from './signaling.service';
import { MediaStreamService, ReactionPayload, WhiteboardPayload, WhiteboardClearPayload } from './media-stream.service';
import { AuthService } from '../../auth/auth.service';

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
  isHandRaised = signal(false);
  sidebarTab = signal<SidebarTab | null>(null);
  messages = signal<ChatMessage[]>([]);
  unreadMessages = signal(0);
  polls = signal<Poll[]>([]);
  showWhiteboard = signal(false);
  showAIPanel = signal(false);
  showHostTools = signal(false);
  showReactions = signal(false);
  hasLeft = signal(false);
  toastMessage = signal<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  localStream = signal<MediaStream | null>(null);

  // ── DataChannel event streams ────────────────────────────────────────────
  readonly reaction$ = new Subject<ReactionEvent>();
  readonly whiteboardDraw$ = new Subject<WhiteboardPayload>();
  readonly whiteboardClear$ = new Subject<void>();

  readonly localParticipant = computed<Participant | null>(() => {
    const user = this.auth.getCurrentUser();
    if (!user) return null;
    return {
      id: 'local',
      name: user.name,
      initials: user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
      avatarColor: '#4f46e5',
      isMuted: this.isMuted(),
      isCameraOn: this.isCameraOn(),
      isHost: true,
      isSpeaking: false,
      isHandRaised: this.isHandRaised(),
      isLocal: true,
      isScreenSharing: this.isScreenSharing(),
      // stream is null when camera is off → VideoTile shows avatar
      stream: this.isCameraOn() ? (this.localStream() ?? undefined) : undefined,
    };
  });

  readonly allParticipants = computed<Participant[]>(() => {
    const local = this.localParticipant();
    const remotes = this.participants();
    return local ? [local, ...remotes] : remotes;
  });

  private subs = new Subscription();
  private _reactionCounter = 0;

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
    this.connectionState.set('idle');
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

  toggleHand(): void {
    this.isHandRaised.update(v => !v);
    this.showToast(this.isHandRaised() ? '✋ Hand raised' : 'Hand lowered', 'info');
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
  }

  toggleReactions(): void {
    this.showReactions.update(v => !v);
    this.showAIPanel.set(false);
    this.showHostTools.set(false);
  }

  vote(pollId: string, optionId: string): void {
    this.polls.update(prev =>
      prev.map(p =>
        p.id === pollId
          ? { ...p, votedOption: optionId, totalVotes: p.totalVotes + 1, options: p.options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o) }
          : p
      )
    );
    this.showToast('Your vote has been recorded', 'success');
  }

  showToast(text: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.toastMessage.set({ text, type });
    setTimeout(() => this.toastMessage.set(null), 3500);
  }
}
