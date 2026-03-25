import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Participant, ChatMessage, Poll, SidebarTab } from '../models/meeting.model';
import { SignalingService } from './signaling.service';
import { MediaStreamService } from './media-stream.service';
import { AuthService } from '../../auth/auth.service';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

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

  // ── UI signals (unchanged) ───────────────────────────────────────────────
  participants = signal<Participant[]>([]);
  isMuted = signal(false);
  isCameraOn = signal(true);
  isScreenSharing = signal(false);
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

  readonly localParticipant = computed<Participant | null>(() => {
    const user = this.auth.getCurrentUser();
    if (!user) return null;
    return {
      id: 'local',
      name: user.name,
      initials: user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      avatarColor: '#4f46e5',
      isMuted: this.isMuted(),
      isCameraOn: this.isCameraOn(),
      isHost: true,
      isSpeaking: false,
      isHandRaised: this.isHandRaised(),
      isLocal: true,
      stream: this.localStream() ?? undefined,
    };
  });

  readonly allParticipants = computed<Participant[]>(() => {
    const local = this.localParticipant();
    const remotes = this.participants();
    return local ? [local, ...remotes] : remotes;
  });

  private subs = new Subscription();

  // ── Join / Leave ─────────────────────────────────────────────────────────

  async joinMeeting(code: string, title = 'Meeting'): Promise<void> {
    this.meetingCode.set(code);
    this.meetingTitle.set(title);
    this.connectionState.set('connecting');
    this.hasLeft.set(false);

    const user = this.auth.getCurrentUser();
    if (!user) {
      this.connectionState.set('error');
      this.showToast('Not authenticated', 'error');
      return;
    }

    try {
      // Start STOMP connection in background — non-blocking
      this.signaling.connect(code, user.id);

      // Connect to LiveKit SFU — this is the critical path
      await this.media.connect(code);

      // LiveKit connected — UI is ready to show
      this.connectionState.set('connected');
    } catch (e) {
      console.error('[Meeting] Join failed', e);
      this.connectionState.set('error');
      this.showToast('Failed to connect to meeting', 'error');
      return;
    }

    // Sync remote participants from LiveKit
    this.subs.add(
      this.media.participants$.subscribe(remotes => {
        this.participants.set(remotes);
      })
    );

    // Sync local stream (for "You" tile)
    this.subs.add(
      this.media.localStream$.subscribe(stream => {
        this.localStream.set(stream);
      })
    );

    // Incoming chat messages from STOMP
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

  async cleanupMedia(): Promise<void> {
    this.subs.unsubscribe();
    this.subs = new Subscription();
    this.signaling.disconnect();
    await this.media.disconnect();
    this.localStream.set(null);
    this.participants.set([]);
    this.connectionState.set('idle');
  }

  // ── Controls ─────────────────────────────────────────────────────────────

  async toggleMic(): Promise<void> {
    const next = !this.isMuted();
    this.isMuted.set(next);
    await this.media.toggleMic(!next);
    this.showToast(next ? 'Microphone muted' : 'Microphone unmuted', 'info');
  }

  async toggleCamera(): Promise<void> {
    const next = !this.isCameraOn();
    this.isCameraOn.set(next);
    await this.media.toggleCamera(next);
    this.showToast(next ? 'Camera started' : 'Camera stopped', 'info');
  }

  async toggleScreenShare(): Promise<void> {
    this.isScreenSharing.update(v => !v);
    await this.media.toggleScreenShare(this.isScreenSharing());
    this.showToast(this.isScreenSharing() ? 'Screen sharing started' : 'Screen sharing stopped', 'info');
  }

  toggleHand(): void {
    this.isHandRaised.update(v => !v);
    this.showToast(this.isHandRaised() ? '✋ Hand raised' : 'Hand lowered', 'info');
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  sendMessage(text: string): void {
    const user = this.auth.getCurrentUser();
    if (!user) return;
    // Optimistically add to local list
    this.messages.update(prev => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        senderId: 'local',
        senderName: user.name,
        text,
        timestamp: new Date(),
        isMe: true,
      },
    ]);
    // Broadcast via STOMP
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
          ? {
              ...p,
              votedOption: optionId,
              totalVotes: p.totalVotes + 1,
              options: p.options.map(o =>
                o.id === optionId ? { ...o, votes: o.votes + 1 } : o
              ),
            }
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
