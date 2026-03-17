import { Component, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingStateService } from '../../services/meeting-state.service';
import { SidebarTab, Participant } from '../../models/meeting.model';

const TABS: { id: SidebarTab; icon: string; label: string }[] = [
  { id: 'participants', icon: 'group', label: 'People' },
  { id: 'chat', icon: 'chat', label: 'Chat' },
  { id: 'polls', icon: 'bar_chart', label: 'Polls' },
  { id: 'qa', icon: 'help', label: 'Q&A' },
];

const QA_QUESTIONS = [
  { id: '1', text: 'Can you share your screen for the demo?', author: 'Sarah Johnson', votes: 5, answered: false },
  { id: '2', text: 'What is the timeline for the next release?', author: 'Michael Chen', votes: 3, answered: true },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sidebar-panel">
      <!-- Tab bar -->
      <div class="sidebar-tabs">
        <div class="tabs-scroll">
          <button
            *ngFor="let tab of tabs"
            class="sidebar-tab"
            [class.active]="ms.sidebarTab() === tab.id"
            (click)="ms.toggleSidebar(tab.id)"
          >
            <span class="material-symbols-outlined">{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
            <div class="tab-indicator" *ngIf="ms.sidebarTab() === tab.id"></div>
          </button>
        </div>
        <button class="sidebar-close-btn" (click)="ms.sidebarTab.set(null)">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Panel content -->
      <div class="sidebar-content">

        <!-- Participants -->
        <ng-container *ngIf="ms.sidebarTab() === 'participants'">
          <div class="participants-panel">
            <div class="participants-count">{{ ms.participants().length }} participants</div>
            <div class="participants-list">
              <p class="section-header" *ngIf="host">HOST</p>
              <div class="participant-row" *ngIf="host">
                <div class="p-avatar" [style.background]="host.avatarColor">{{ host.initials }}</div>
                <div class="p-info">
                  <div class="p-name-row">
                    <span class="p-name">{{ host.name }}</span>
                    <span class="material-symbols-outlined host-crown">workspace_premium</span>
                  </div>
                  <span class="p-hand" *ngIf="host.isHandRaised">✋ Raised hand</span>
                </div>
                <div class="p-status-icons">
                  <span class="material-symbols-outlined status-icon" *ngIf="!host.isCameraOn">videocam_off</span>
                  <span class="material-symbols-outlined status-icon" [class.muted]="host.isMuted">{{ host.isMuted ? 'mic_off' : 'mic' }}</span>
                </div>
              </div>

              <p class="section-header mt-2">PARTICIPANTS</p>
              <div class="participant-row" *ngFor="let p of others">
                <div class="p-avatar" [style.background]="p.avatarColor">{{ p.initials }}</div>
                <div class="p-info">
                  <div class="p-name-row">
                    <span class="p-name">{{ p.name }}</span>
                    <span class="p-you" *ngIf="p.id === 'local'">(You)</span>
                  </div>
                  <span class="p-hand" *ngIf="p.isHandRaised">✋ Raised hand</span>
                </div>
                <div class="p-status-icons">
                  <span class="material-symbols-outlined status-icon" *ngIf="!p.isCameraOn">videocam_off</span>
                  <span class="material-symbols-outlined status-icon" [class.muted]="p.isMuted">{{ p.isMuted ? 'mic_off' : 'mic' }}</span>
                </div>
              </div>
            </div>
            <div class="participants-footer">
              <button class="footer-btn secondary">Mute All</button>
              <button class="footer-btn primary">Invite</button>
            </div>
          </div>
        </ng-container>

        <!-- Chat -->
        <ng-container *ngIf="ms.sidebarTab() === 'chat'">
          <div class="chat-panel">
            <div class="chat-messages" #chatMessages>
              <div *ngFor="let msg of ms.messages()"
                   class="chat-msg"
                   [class.chat-msg-me]="msg.senderId === 'local'"
                   [class.chat-msg-other]="msg.senderId !== 'local'">
                <div *ngIf="msg.senderId !== 'local'" class="chat-avatar"
                     [style.background]="getParticipantColor(msg.senderId)">
                  {{ getParticipantInitials(msg.senderId) }}
                </div>
                <div class="chat-bubble-wrap">
                  <p class="chat-sender" *ngIf="msg.senderId !== 'local'">{{ msg.senderName }}</p>
                  <div class="chat-bubble" [class.mine]="msg.senderId === 'local'">{{ msg.text }}</div>
                  <p class="chat-time">{{ msg.timestamp | date:'HH:mm' }}</p>
                </div>
              </div>
              <div #chatBottom></div>
            </div>
            <div class="chat-input-area">
              <button class="chat-icon-btn">
                <span class="material-symbols-outlined">sentiment_satisfied</span>
              </button>
              <input class="chat-input"
                     [(ngModel)]="chatInput"
                     placeholder="Message everyone..."
                     (keydown.enter)="sendMsg()" />
              <button class="chat-icon-btn">
                <span class="material-symbols-outlined">attach_file</span>
              </button>
              <button class="chat-send-btn" [disabled]="!chatInput.trim()" (click)="sendMsg()">
                <span class="material-symbols-outlined">send</span>
              </button>
            </div>
          </div>
        </ng-container>

        <!-- Polls -->
        <ng-container *ngIf="ms.sidebarTab() === 'polls'">
          <div class="polls-panel">
            <div *ngFor="let poll of ms.polls()" class="poll-card">
              <p class="poll-question">{{ poll.question }}</p>
              <div class="poll-options">
                <button *ngFor="let opt of poll.options"
                        class="poll-option"
                        [class.voted]="poll.votedOption === opt.id"
                        [class.revealed]="!!poll.votedOption"
                        [disabled]="!!poll.votedOption"
                        (click)="ms.vote(poll.id, opt.id)">
                  <div class="poll-fill" *ngIf="poll.votedOption"
                       [style.width]="getPct(opt.votes, poll.totalVotes) + '%'"></div>
                  <div class="poll-option-content">
                    <span class="material-symbols-outlined voted-check" *ngIf="poll.votedOption === opt.id">check</span>
                    <span class="opt-text">{{ opt.text }}</span>
                    <span class="opt-pct" *ngIf="poll.votedOption">{{ getPct(opt.votes, poll.totalVotes) }}%</span>
                  </div>
                </button>
              </div>
              <p class="poll-total" *ngIf="poll.votedOption">{{ poll.totalVotes }} votes total</p>
            </div>
            <div class="polls-empty" *ngIf="ms.polls().length === 0">
              <span class="material-symbols-outlined">bar_chart</span>
              <p>No active polls</p>
            </div>
          </div>
        </ng-container>

        <!-- Q&A -->
        <ng-container *ngIf="ms.sidebarTab() === 'qa'">
          <div class="qa-panel">
            <div *ngFor="let q of qaQuestions" class="qa-card" [class.answered]="q.answered">
              <p class="qa-text">{{ q.text }}</p>
              <div class="qa-meta">
                <span class="qa-author">{{ q.author }}</span>
                <div class="qa-right">
                  <span class="answered-badge" *ngIf="q.answered">
                    <span class="material-symbols-outlined">check</span> Answered
                  </span>
                  <button class="upvote-btn">↑ {{ q.votes }}</button>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

      </div>
    </div>
  `,
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements AfterViewChecked {
  ms = inject(MeetingStateService);
  tabs = TABS;
  chatInput = '';
  qaQuestions = QA_QUESTIONS;

  @ViewChild('chatBottom') private chatBottom!: ElementRef;

  get host(): Participant | undefined {
    return this.ms.participants().find(p => p.isHost);
  }
  get others(): Participant[] {
    return this.ms.participants().filter(p => !p.isHost);
  }

  ngAfterViewChecked() {
    this.chatBottom?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }

  sendMsg() {
    if (!this.chatInput.trim()) return;
    this.ms.sendMessage(this.chatInput.trim());
    this.chatInput = '';
  }

  getPct(votes: number, total: number): number {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  getParticipantColor(senderId: string): string {
    return this.ms.participants().find(p => p.id === senderId)?.avatarColor ?? '#666';
  }

  getParticipantInitials(senderId: string): string {
    return this.ms.participants().find(p => p.id === senderId)?.initials ?? '?';
  }
}
