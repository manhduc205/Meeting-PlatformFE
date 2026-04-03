import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingStateService } from '../../services/meeting-state.service';

const REACTIONS = ['👍', '👏', '😂', '❤️', '🎉', '🤔', '👋'];

@Component({
  selector: 'app-control-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ctrl-wrapper">

      <!-- Reactions popover -->
      <div class="reactions-popover" *ngIf="ms.showReactions()">
        <button
          class="reaction-btn"
          *ngFor="let e of reactions"
          (click)="pickReaction(e)"
        >{{ e }}</button>
      </div>

      <!-- Main control bar -->
      <div class="ctrl-bar">

        <!-- Mic -->
        <button
          class="ctrl-btn"
          [class.active]="!ms.isMuted()"
          [class.off]="ms.isMuted()"
          (click)="onMicClick()"
          title="{{ ms.isMuted() ? 'Unmute' : 'Mute' }}"
        >
          <span class="ctrl-icon-wrap">
            <!-- Mic on -->
            <svg *ngIf="!ms.isMuted()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <!-- Mic off -->
            <svg *ngIf="ms.isMuted()" class="icon-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <span class="ctrl-arrow">
              <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18,15 12,9 6,15"/></svg>
            </span>
          </span>
          <span class="ctrl-label">{{ ms.isMuted() ? 'Unmute' : 'Mute' }}</span>
        </button>

        <!-- Camera -->
        <button
          class="ctrl-btn"
          [class.active]="ms.isCameraOn()"
          [class.off]="!ms.isCameraOn()"
          (click)="onCamClick()"
          title="{{ ms.isCameraOn() ? 'Stop Video' : 'Start Video' }}"
        >
          <span class="ctrl-icon-wrap">
            <!-- Camera on -->
            <svg *ngIf="ms.isCameraOn()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="23,7 16,12 23,17 23,7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <!-- Camera off -->
            <svg *ngIf="!ms.isCameraOn()" class="icon-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            <span class="ctrl-arrow">
              <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18,15 12,9 6,15"/></svg>
            </span>
          </span>
          <span class="ctrl-label">{{ ms.isCameraOn() ? 'Stop Video' : 'Start Video' }}</span>
        </button>

        <div class="ctrl-divider"></div>

        <!-- Screen Share -->
        <button
          class="ctrl-btn"
          [class.active]="ms.isScreenSharing()"
          (click)="onScreenShareClick()"
          title="{{ ms.isScreenSharing() ? 'Stop Share' : 'Share' }}"
        >
          <span class="ctrl-icon-wrap">
            <svg *ngIf="!ms.isScreenSharing()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3"/>
              <path d="M8 21h8"/>
              <path d="M12 17v4"/>
              <path d="m17 8 5-5"/>
              <path d="M17 3h5v5"/>
            </svg>
            <svg *ngIf="ms.isScreenSharing()" class="icon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3"/>
              <path d="M8 21h8"/>
              <path d="M12 17v4"/>
              <path d="m22 3-5 5"/>
              <path d="m2 2 20 20"/>
            </svg>
            <span class="ctrl-arrow">
              <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18,15 12,9 6,15"/></svg>
            </span>
          </span>
          <span class="ctrl-label">{{ ms.isScreenSharing() ? 'Stop Share' : 'Share' }}</span>
        </button>

        <div class="ctrl-divider"></div>

        <!-- Participants -->
        <button
          class="ctrl-btn"
          [class.active]="ms.sidebarTab() === 'participants'"
          (click)="ms.toggleSidebar('participants')"
        >
          <span class="ctrl-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </span>
          <span class="ctrl-label">Participants</span>
        </button>

        <!-- Chat -->
        <button
          class="ctrl-btn"
          [class.active]="ms.sidebarTab() === 'chat'"
          (click)="ms.toggleSidebar('chat')"
        >
          <span class="ctrl-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="ctrl-badge" *ngIf="ms.unreadMessages() > 0">
              {{ ms.unreadMessages() > 9 ? '9+' : ms.unreadMessages() }}
            </span>
          </span>
          <span class="ctrl-label">Chat</span>
        </button>

        <!-- Reactions -->
        <button
          class="ctrl-btn"
          [class.active]="ms.showReactions()"
          (click)="ms.toggleReactions()"
        >
          <span class="ctrl-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </span>
          <span class="ctrl-label">React</span>
        </button>

        <!-- Raise Hand -->
        <button
          class="ctrl-btn"
          [class.active]="ms.isHandRaised()"
          (click)="ms.toggleHand()"
        >
          <span class="ctrl-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
            </svg>
          </span>
          <span class="ctrl-label">{{ ms.isHandRaised() ? 'Lower Hand' : 'Raise Hand' }}</span>
        </button>

        <!-- Whiteboard -->
        <button
          class="ctrl-btn"
          [class.active]="ms.showWhiteboard()"
          (click)="ms.showWhiteboard.update(v => !v)"
        >
          <span class="ctrl-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </span>
          <span class="ctrl-label">Whiteboard</span>
        </button>

        <div class="ctrl-divider"></div>

        <!-- Host Tools -->
        <button
          class="ctrl-btn"
          [class.active]="ms.showHostTools()"
          (click)="ms.toggleHostTools()"
        >
          <span class="ctrl-icon-wrap">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </span>
          <span class="ctrl-label">Host tools</span>
        </button>

        <!-- AI Companion -->
        <button
          class="ctrl-btn ai-btn"
          [class.active]="ms.showAIPanel()"
          (click)="ms.toggleAIPanel()"
        >
          <span class="ctrl-icon-wrap">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
            </svg>
          </span>
          <span class="ctrl-label">AI Companion</span>
        </button>

        <!-- More -->
        <button class="ctrl-btn" (click)="showMore = !showMore">
          <span class="ctrl-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
            </svg>
          </span>
          <span class="ctrl-label">More</span>
        </button>

        <div class="ctrl-divider"></div>

        <!-- End call -->
        <button class="ctrl-btn danger-btn" (click)="ms.endCall()">
          <span class="ctrl-icon-wrap">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
              <line x1="22" y1="2" x2="2" y2="22"/>
            </svg>
          </span>
          <span class="ctrl-label">End</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./control-bar.component.scss']
})
export class ControlBarComponent {
  ms = inject(MeetingStateService);
  reactions = REACTIONS;
  showMore = false;

  onMicClick(): void   { this.ms.toggleMic(); }
  onCamClick(): void   { this.ms.toggleCamera(); }
  onScreenShareClick() { this.ms.toggleScreenShare(); }

  /** Send reaction via LiveKit DataChannel */
  pickReaction(emoji: string): void {
    this.ms.sendReaction(emoji);
  }
}
