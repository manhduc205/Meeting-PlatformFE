import { Injectable, signal, computed } from '@angular/core';
import { Participant, ChatMessage, Poll, SidebarTab } from '../models/meeting.model';

const PHOTO_1 = 'https://images.unsplash.com/photo-1527445741084-0d3c140baf80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400';
const PHOTO_2 = 'https://images.unsplash.com/photo-1771050889377-b68415885c64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400';
const PHOTO_3 = 'https://images.unsplash.com/photo-1765648684555-de2d0f6af467?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400';
const PHOTO_4 = 'https://images.unsplash.com/photo-1622151834625-66296f9f0e96?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400';

const INITIAL_PARTICIPANTS: Participant[] = [
  { id: 'local', name: 'Alex Morgan', initials: 'AM', avatarColor: '#4f46e5', isMuted: false, isCameraOn: true, isHost: false, isSpeaking: false, isHandRaised: false, videoSrc: PHOTO_4 },
  { id: 'p-duc', name: 'Nguyễn Đức', initials: 'NĐ', avatarColor: '#0ea5e9', isMuted: false, isCameraOn: true, isHost: true, isSpeaking: true, isHandRaised: false, videoSrc: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400' },
  { id: 'p-sarah', name: 'Sarah Johnson', initials: 'SJ', avatarColor: '#ec4899', isMuted: true, isCameraOn: true, isHost: false, isSpeaking: false, isHandRaised: false, videoSrc: PHOTO_1 },
  { id: 'p-michael', name: 'Michael Chen', initials: 'MC', avatarColor: '#10b981', isMuted: false, isCameraOn: true, isHost: false, isSpeaking: false, isHandRaised: true, videoSrc: PHOTO_2 },
  { id: 'p-emily', name: 'Emily Davis', initials: 'ED', avatarColor: '#f59e0b', isMuted: true, isCameraOn: true, isHost: false, isSpeaking: false, isHandRaised: false, videoSrc: PHOTO_3 },
  { id: 'p-david', name: 'David Kim', initials: 'DK', avatarColor: '#8b5cf6', isMuted: false, isCameraOn: false, isHost: false, isSpeaking: false, isHandRaised: false },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 'm1', senderId: 'p-duc', senderName: 'Nguyễn Đức', text: "Welcome everyone! Let's get started.", timestamp: new Date(Date.now() - 8 * 60000) },
  { id: 'm2', senderId: 'p-sarah', senderName: 'Sarah Johnson', text: 'Thanks! Can you share your screen for the demo?', timestamp: new Date(Date.now() - 6 * 60000) },
  { id: 'm3', senderId: 'p-michael', senderName: 'Michael Chen', text: 'Great presentation so far 👍', timestamp: new Date(Date.now() - 3 * 60000) },
  { id: 'm4', senderId: 'p-duc', senderName: 'Nguyễn Đức', text: "I'll share my screen in a moment. First, let me finish the overview.", timestamp: new Date(Date.now() - 1 * 60000) },
];

const INITIAL_POLLS: Poll[] = [
  {
    id: 'poll1',
    question: 'Which feature should we prioritize next sprint?',
    options: [
      { id: 'o1', text: 'Dark mode support', votes: 8 },
      { id: 'o2', text: 'Mobile app redesign', votes: 5 },
      { id: 'o3', text: 'Performance improvements', votes: 12 },
      { id: 'o4', text: 'New integrations', votes: 3 },
    ],
    totalVotes: 28,
  }
];

@Injectable({ providedIn: 'root' })
export class MeetingStateService {
  participants = signal<Participant[]>(INITIAL_PARTICIPANTS);
  isMuted = signal(false);
  isCameraOn = signal(true);
  isScreenSharing = signal(false);
  isHandRaised = signal(false);
  sidebarTab = signal<SidebarTab | null>(null);
  messages = signal<ChatMessage[]>(INITIAL_MESSAGES);
  unreadMessages = signal(0);
  polls = signal<Poll[]>(INITIAL_POLLS);
  showWhiteboard = signal(false);
  showAIPanel = signal(false);
  showHostTools = signal(false);
  showReactions = signal(false);
  hasLeft = signal(false);
  toastMessage = signal<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);

  private speakerIds = ['p-duc', 'p-michael', 'p-sarah', 'local'];
  private speakerIdx = 0;
  private speakerInterval: any;
  private autoMsgTimeout: any;

  startSpeakerRotation() {
    this.speakerInterval = setInterval(() => {
      this.speakerIdx = (this.speakerIdx + 1) % this.speakerIds.length;
      const currentSpeakerId = this.speakerIds[this.speakerIdx];
      this.participants.update(prev =>
        prev.map(p => ({ ...p, isSpeaking: p.id === currentSpeakerId && !p.isMuted }))
      );
    }, 4000);

    // Simulate incoming message after 12s
    this.autoMsgTimeout = setTimeout(() => {
      const newMsg: ChatMessage = {
        id: `m-auto-${Date.now()}`,
        senderId: 'p-emily',
        senderName: 'Emily Davis',
        text: 'When will we review the Q3 roadmap?',
        timestamp: new Date(),
      };
      this.messages.update(prev => [...prev, newMsg]);
      if (this.sidebarTab() !== 'chat') {
        this.unreadMessages.update(n => n + 1);
        this.showToast('Emily Davis: When will we review the Q3 roadmap?', 'info');
      }
    }, 12000);
  }

  stopSpeakerRotation() {
    clearInterval(this.speakerInterval);
    clearTimeout(this.autoMsgTimeout);
  }

  showToast(text: string, type: 'info' | 'success' | 'error' = 'info') {
    this.toastMessage.set({ text, type });
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  toggleMic() {
    this.isMuted.update(v => !v);
    this.participants.update(prev =>
      prev.map(p => p.id === 'local' ? { ...p, isMuted: this.isMuted() } : p)
    );
    this.showToast(this.isMuted() ? 'Microphone muted' : 'Microphone unmuted', 'info');
  }

  toggleCamera() {
    this.isCameraOn.update(v => !v);
    this.participants.update(prev =>
      prev.map(p => p.id === 'local' ? { ...p, isCameraOn: this.isCameraOn() } : p)
    );
    this.showToast(this.isCameraOn() ? 'Camera started' : 'Camera stopped', 'info');
  }

  toggleScreenShare() {
    this.isScreenSharing.update(v => !v);
    this.showToast(this.isScreenSharing() ? 'Screen sharing started' : 'Screen sharing stopped', 'info');
  }

  toggleHand() {
    this.isHandRaised.update(v => !v);
    this.participants.update(prev =>
      prev.map(p => p.id === 'local' ? { ...p, isHandRaised: this.isHandRaised() } : p)
    );
    this.showToast(this.isHandRaised() ? '✋ Hand raised' : 'Hand lowered', 'info');
  }

  toggleSidebar(tab: SidebarTab | null) {
    this.sidebarTab.update(prev => prev === tab ? null : tab);
    this.showHostTools.set(false);
    this.showAIPanel.set(false);
    this.showReactions.set(false);
    if (tab === 'chat') this.unreadMessages.set(0);
  }

  toggleAIPanel() {
    this.showAIPanel.update(v => !v);
    this.showHostTools.set(false);
    this.showReactions.set(false);
  }

  toggleHostTools() {
    this.showHostTools.update(v => !v);
    this.showAIPanel.set(false);
    this.showReactions.set(false);
  }

  toggleReactions() {
    this.showReactions.update(v => !v);
    this.showAIPanel.set(false);
    this.showHostTools.set(false);
  }

  sendMessage(text: string) {
    this.messages.update(prev => [
      ...prev,
      { id: `m-${Date.now()}`, senderId: 'local', senderName: 'Alex Morgan', text, timestamp: new Date(), isMe: true }
    ]);
  }

  vote(pollId: string, optionId: string) {
    this.polls.update(prev =>
      prev.map(p => p.id === pollId ? {
        ...p,
        votedOption: optionId,
        totalVotes: p.totalVotes + 1,
        options: p.options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o)
      } : p)
    );
    this.showToast('Your vote has been recorded', 'success');
  }

  endCall() {
    this.hasLeft.set(true);
    this.stopSpeakerRotation();
    this.showToast('You have left the meeting', 'error');
  }

  rejoin() {
    this.hasLeft.set(false);
    this.startSpeakerRotation();
  }
}
