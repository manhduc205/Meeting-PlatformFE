import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingStateService } from '../../services/meeting-state.service';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="top-bar">
      <!-- Left: brand + meeting info -->
      <div class="tb-left">
        <div class="tb-brand-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff">
            <path d="M4 4h10a2 2 0 0 1 2 2v3.5l4-3V17.5l-4-3V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
          </svg>
        </div>

        <div class="tb-meeting-info">
          <p class="tb-title">{{ meetingTitle }}</p>
          <div class="tb-code-row">
            <span class="tb-code">{{ meetingCode }}</span>
            <button class="tb-copy-btn" (click)="copyCode()" title="Copy meeting ID">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="tb-divider"></div>


        <!-- Recording indicator -->
        <div class="tb-rec-wrapper"
             *ngIf="ms.isRecording()"
             (mouseenter)="showRecPopover = true"
             (mouseleave)="startHidePopover()">
          <button class="tb-rec-badge" (click)="showRecPopover = !showRecPopover">
            <span class="tb-rec-dot"></span>
            <span class="tb-rec-label">REC</span>
            <span class="tb-rec-time">{{ formatDuration(ms.recordingDuration()) }}</span>
          </button>

          <!-- Hover popover -->
          <div class="tb-rec-popover" *ngIf="showRecPopover"
               (mouseenter)="cancelHidePopover()"
               (mouseleave)="startHidePopover()">
            <div class="tb-rec-popover-header">
              <span class="tb-rec-popover-dot"></span>
              <span class="tb-rec-popover-title">Recording</span>
            </div>
            <p class="tb-rec-popover-time">{{ formatDuration(ms.recordingDuration()) }}</p>
            <div class="tb-rec-popover-actions">
              <button class="tb-rec-stop-btn" (click)="stopRecording()">
                <div class="tb-rec-stop-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                </div>
                <span>Stop Recording</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Center: status pills -->
      <div class="tb-center">
        <div class="tb-pill">
          <span class="tb-pill-icon green">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </span>
          <span>Encrypted</span>
        </div>

        <div class="tb-pill">
          <span class="tb-pill-icon blue">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </span>
          <span>{{ participantCount }} participants</span>
        </div>

        <div class="tb-pill tb-pill-btn">
          <span class="tb-pill-icon">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </span>
          <span>Meeting info</span>
        </div>
      </div>

      <!-- Right: view toggle + user -->
      <div class="tb-right">
        <div class="layout-menu-container">
          <button class="tb-icon-btn" (click)="toggleLayoutMenu()" title="View options">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1"/>
              <rect x="9" y="1" width="6" height="6" rx="1"/>
              <rect x="1" y="9" width="6" height="6" rx="1"/>
              <rect x="9" y="9" width="6" height="6" rx="1"/>
            </svg>
            <span class="chevron" [class.open]="showLayoutMenu">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </span>
          </button>
          
          <div class="layout-dropdown" *ngIf="showLayoutMenu">
            <button class="layout-item" (click)="setLayout('speaker')">
              <span class="check" [class.active]="ms.layoutMode() === 'speaker'">✓</span>
              <span>Speaker</span>
              <span class="icon">▀</span>
            </button>
            <button class="layout-item" (click)="setLayout('gallery')">
              <span class="check" [class.active]="ms.layoutMode() === 'gallery'">✓</span>
              <span>Gallery</span>
              <span class="icon">⸬</span>
            </button>
            <button class="layout-item" (click)="setLayout('dynamic')">
              <span class="check" [class.active]="ms.layoutMode() === 'dynamic'">✓</span>
              <span>Dynamic gallery</span>
              <span class="icon">◫</span>
            </button>
            <button class="layout-item" (click)="setLayout('multi')">
              <span class="check" [class.active]="ms.layoutMode() === 'multi'">✓</span>
              <span>Multi-speaker</span>
              <span class="icon">⊞</span>
            </button>
          </div>
        </div>

        <div class="tb-divider"></div>

        <!-- Waiting room notification badge (host only) -->
        <button
          class="tb-waiting-badge"
          *ngIf="ms.isHost() && ms.waitingParticipants().length > 0"
          (click)="openWaitingRoom()"
          title="Có người đang chờ được duyệt"
        >
          <span class="tb-waiting-dot"></span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          <span class="tb-waiting-text">Cho phép {{ ms.waitingParticipants().length }} khách vào</span>
        </button>

        <div class="tb-divider"></div>

        <button class="tb-user-btn">
          <div class="tb-avatar" [style.background-color]="'#4f46e5'">{{ localUserInitials }}</div>
          <span class="tb-username">{{ localUserName }}</span>
          <span class="tb-chevron">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6,9 12,15 18,9"/>
            </svg>
          </span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./top-bar.component.scss']
})
export class TopBarComponent {
  @Input() meetingTitle = 'Product Review Q3';
  @Input() meetingCode = '856-3941-2204';
  @Input() participantCount = 6;
  @Input() localUserName = 'Alex Morgan';
  @Input() localUserInitials = 'AM';

  elapsed = '00:42:17';
  ms = inject(MeetingStateService);
  showLayoutMenu = false;
  showRecPopover = false;
  private _hidePopoverTimer: ReturnType<typeof setTimeout> | null = null;

  toggleLayoutMenu() {
    this.showLayoutMenu = !this.showLayoutMenu;
  }

  setLayout(mode: 'speaker' | 'gallery' | 'dynamic' | 'multi') {
    this.ms.layoutMode.set(mode);
    this.showLayoutMenu = false;
  }

  copyCode() {
    navigator.clipboard.writeText(this.meetingCode).catch(() => {});
    this.ms.showToast('Meeting ID copied!', 'success');
  }

  // ── Recording controls ────────────────────────────────────────────────────

  stopRecording() {
    this.ms.stopRecording();
    this.showRecPopover = false;
  }

  openWaitingRoom() {
    this.ms.toggleSidebar('participants');
  }

  startHidePopover() {
    this._hidePopoverTimer = setTimeout(() => this.showRecPopover = false, 300);
  }

  cancelHidePopover() {
    if (this._hidePopoverTimer) {
      clearTimeout(this._hidePopoverTimer);
      this._hidePopoverTimer = null;
    }
  }

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
