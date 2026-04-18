import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingStateService } from '../../services/meeting-state.service';
import { HostControlService } from '../../services/host-control.service';
import { Participant, Poll } from '../../models/meeting.model';

type Section = 'main' | 'spotlight' | 'remove' | 'poll';

@Component({
  selector: 'app-host-tools-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="host-tools-panel">
      <!-- Header -->
      <div class="htp-header">
        <div class="htp-header-left">
          <div class="htp-icon-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" class="htp-icon-blue">
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <span class="htp-title">{{
            section() === 'main' ? 'Host Tools' :
            section() === 'spotlight' ? 'Spotlight Participant' :
            section() === 'poll' ? 'Polls' : 'Remove Participant'
          }}</span>
        </div>
        <button class="htp-close-btn" (click)="handleClose()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Main Section -->
      <div class="htp-section" *ngIf="section() === 'main'">
        <!-- Security -->
        <p class="htp-section-title">Security</p>

        <button class="htp-row" [class.active]="isLocked()" (click)="toggleLock()" [disabled]="loading()">
          <div class="htp-row-icon" [class.active]="isLocked()">
            <svg *ngIf="isLocked()" class="htp-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <svg *ngIf="!isLocked()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
          </div>
          <div class="htp-row-text">
            <p class="htp-row-label" [class.active]="isLocked()">{{ isLocked() ? 'Unlock Meeting' : 'Lock Meeting' }}</p>
            <p class="htp-row-desc">{{ isLocked() ? 'Allow new participants to join' : 'Prevent new participants from joining' }}</p>
          </div>
          <div class="htp-toggle" [class.on]="isLocked()">
            <div class="htp-toggle-thumb"></div>
          </div>
        </button>

        <button class="htp-row" [class.active]="waitingRoom()" (click)="toggleWaitingRoom()" [disabled]="loading()">
          <div class="htp-row-icon" [class.active]="waitingRoom()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="htp-row-text">
            <p class="htp-row-label" [class.active]="waitingRoom()">Waiting Room</p>
            <p class="htp-row-desc">{{ waitingRoom() ? 'Waiting room is ON' : 'Admit participants manually' }}</p>
          </div>
          <div class="htp-toggle" [class.on]="waitingRoom()">
            <div class="htp-toggle-thumb"></div>
          </div>
        </button>

        <!-- Audio & Video -->
        <p class="htp-section-title mt-1">Audio &amp; Video</p>

        <button class="htp-row" [class.active]="allMuted()" (click)="toggleMuteAll()" [disabled]="loading()">
          <div class="htp-row-icon" [class.active]="allMuted()">
            <svg *ngIf="allMuted()" class="htp-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><line x1="1" y1="1" x2="23" y2="23"/><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/></svg>
            <svg *ngIf="!allMuted()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          </div>
          <div class="htp-row-text">
            <p class="htp-row-label" [class.active]="allMuted()">Mute All</p>
            <p class="htp-row-desc">Silence all participants now</p>
          </div>
          <!-- Mute All is a one-shot command, no toggle switch -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" class="htp-chevron"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button class="htp-row" [class.active]="shareDisabled()" (click)="toggleShare()" [disabled]="loading()">
          <div class="htp-row-icon" [class.active]="shareDisabled()">
            <svg *ngIf="shareDisabled()" class="htp-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M17 16V3a2 2 0 0 0-2-2H4"/><path d="M8 21h8"/><path d="M12 17v4"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M22 13v-3"/><path d="M4 4H2v12a2 2 0 0 0 2 2h14l-2-2H4V6l-2-2z"/></svg>
            <svg *ngIf="!shareDisabled()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div class="htp-row-text">
            <p class="htp-row-label" [class.active]="shareDisabled()">{{ shareDisabled() ? 'Enable Screen Share' : 'Disable Screen Share' }}</p>
            <p class="htp-row-desc">{{ shareDisabled() ? 'Participants can share screen' : 'Prevent participants from sharing' }}</p>
          </div>
          <div class="htp-toggle" [class.on]="shareDisabled()">
            <div class="htp-toggle-thumb"></div>
          </div>
        </button>

        <!-- Participants section -->
        <p class="htp-section-title mt-1">Participants</p>

        <button class="htp-nav-btn" (click)="section.set('spotlight')">
          <div class="htp-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div class="htp-nav-text">
            <p class="htp-nav-label">Spotlight Participant</p>
            <p *ngIf="spotlightId()" class="htp-nav-sub">{{ getSpotlightName() }}</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" class="htp-chevron"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button class="htp-nav-btn htp-nav-red" (click)="section.set('remove')">
          <div class="htp-nav-icon-red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
          </div>
          <div class="htp-nav-text">
            <p class="htp-nav-label-red">Remove Participant</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" class="htp-chevron-red"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <!-- Polls nav -->
        <p class="htp-section-title mt-1">Engagement</p>

        <button class="htp-nav-btn htp-nav-poll" (click)="section.set('poll')">
          <div class="htp-nav-icon htp-nav-icon-poll">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div class="htp-nav-text">
            <p class="htp-nav-label">Polls</p>
            <p class="htp-nav-sub" *ngIf="ms.polls().length > 0">{{ ms.polls().length }} poll{{ ms.polls().length !== 1 ? 's' : '' }}</p>
            <p class="htp-nav-sub-dim" *ngIf="ms.polls().length === 0">No active polls</p>
          </div>
          <span class="htp-poll-badge" *ngIf="activePollCount() > 0">{{ activePollCount() }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" class="htp-chevron"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <!-- End meeting -->
        <div class="htp-end-wrap">
          <button class="htp-end-btn" (click)="endMeeting()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            End Meeting for All
          </button>
        </div>
      </div>

      <!-- Spotlight Section -->
      <div class="htp-list-section" *ngIf="section() === 'spotlight'">
        <button *ngIf="spotlightId()" class="htp-list-btn" (click)="clearSpotlight()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" class="htp-icon-dim"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
          <span class="htp-list-text-dim">Remove spotlight</span>
        </button>
        <button
          *ngFor="let p of otherParticipants(); trackBy: trackById"
          class="htp-list-btn htp-list-group"
          (click)="setSpotlight(p)"
        >
          <div class="htp-avatar" [style.background-color]="p.avatarColor">{{ p.initials }}</div>
          <div class="htp-flex-1">
            <p class="htp-list-name">
              {{ p.name }}
              <svg *ngIf="p.isHost" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="9" height="9" class="htp-crown"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
            </p>
          </div>
          <svg *ngIf="spotlightId() === p.id" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" class="htp-icon-blue"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>

      <!-- Remove Section -->
      <div class="htp-list-section" *ngIf="section() === 'remove'">
        <p class="htp-section-title px-4 pb-2">Select a participant to remove</p>
        <button
          *ngFor="let p of nonHostParticipants(); trackBy: trackById"
          class="htp-list-btn htp-list-group-red"
          (click)="removeParticipant(p)"
        >
          <div class="htp-avatar" [style.background-color]="p.avatarColor">{{ p.initials }}</div>
          <p class="htp-flex-1 htp-list-name group-hover-red">{{ p.name }}</p>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" class="htp-icon-red-hover"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
        </button>
      </div>

      <!-- ── Poll Section ────────────────────────────────────────── -->
      <div class="htp-poll-section" *ngIf="section() === 'poll'">

        <!-- Create Form Toggle -->
        <div class="htp-poll-create-bar">
          <span class="htp-poll-create-label">New Poll</span>
          <button
            class="htp-poll-create-toggle"
            [class.open]="showPollForm()"
            (click)="showPollForm.update(v => !v)"
          >
            <svg *ngIf="!showPollForm()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <svg *ngIf="showPollForm()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {{ showPollForm() ? 'Cancel' : 'Create' }}
          </button>
        </div>

        <!-- Create Form -->
        <div class="htp-poll-form" *ngIf="showPollForm()">
          <textarea
            class="htp-poll-question"
            [(ngModel)]="pollQuestion"
            placeholder="Ask your audience..."
            rows="2"
            maxlength="300"
          ></textarea>

          <div class="htp-poll-opts-list">
            <div *ngFor="let opt of pollOptions; let i = index; trackBy: trackPollOptIdx" class="htp-poll-opt-row">
              <span class="htp-poll-opt-letter">{{ pollLetters[i] }}</span>
              <input
                class="htp-poll-opt-input"
                [(ngModel)]="pollOptions[i]"
                [placeholder]="'Option ' + pollLetters[i]"
                maxlength="100"
              />
              <button
                class="htp-poll-opt-remove"
                *ngIf="pollOptions.length > 2"
                (click)="removePollOption(i)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>

          <button class="htp-poll-add-opt" *ngIf="pollOptions.length < 6" (click)="addPollOption()">
            + Add option
          </button>

          <div class="htp-poll-multi-row">
            <span class="htp-poll-multi-label">Multiple choice</span>
            <button
              class="htp-toggle-sm"
              [class.on]="pollMultiple"
              (click)="pollMultiple = !pollMultiple"
            ><span class="htp-toggle-sm-thumb"></span></button>
          </div>

          <button
            class="htp-poll-launch"
            [disabled]="!canLaunchPoll() || isLaunchingPoll()"
            (click)="launchPoll()"
          >
            <svg *ngIf="!isLaunchingPoll()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            <svg *ngIf="isLaunchingPoll()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="9" stroke-dasharray="40" stroke-dashoffset="15"/></svg>
            {{ isLaunchingPoll() ? 'Đang tạo...' : 'Launch Poll' }}
          </button>
        </div>

        <!-- Divider -->
        <div class="htp-poll-divider" *ngIf="ms.polls().length > 0"></div>

        <!-- Existing polls -->
        <div class="htp-poll-list-wrap" *ngIf="!showPollForm()">
          <div *ngIf="ms.polls().length === 0" class="htp-poll-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" style="opacity:.35">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <p>No polls yet</p>
          </div>

          <div *ngFor="let poll of ms.polls(); trackBy: trackPollId" class="htp-poll-card" [class.closed]="poll.status === 'CLOSED'">
            <div class="htp-poll-card-header">
              <span class="htp-poll-status" [class.open]="poll.status === 'OPEN'">
                <span class="htp-poll-dot"></span>
                {{ poll.status === 'OPEN' ? 'Live' : 'Closed' }}
              </span>
              <button
                *ngIf="poll.status === 'OPEN'"
                class="htp-poll-close-btn"
                (click)="ms.closePoll(poll.id)"
              >Close</button>
            </div>
            <p class="htp-poll-q">{{ poll.question }}</p>
            <div class="htp-poll-bars">
              <div *ngFor="let opt of poll.options; trackBy: trackPollOptId" class="htp-poll-bar-row">
                <span class="htp-poll-bar-label">{{ opt.text }}</span>
                <div class="htp-poll-bar-wrap">
                  <div class="htp-poll-bar-fill" [style.width]="getPollPct(opt.voteCount, poll) + '%'"></div>
                </div>
                <span class="htp-poll-bar-pct">{{ getPollPct(opt.voteCount, poll) }}%</span>
              </div>
            </div>
            <p class="htp-poll-total">{{ getTotalVotes(poll) }} votes</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./host-tools-panel.component.scss']
})
export class HostToolsPanelComponent {
  @Input() participants: Participant[] = [];
  @Output() closePanel = new EventEmitter<void>();

  ms = inject(MeetingStateService);
  private hostControl = inject(HostControlService);

  // ── Local UI signals (optimistic) ─────────────────────────────────────────
  isLocked = signal(false);
  allMuted = signal(false);
  shareDisabled = signal(false);
  waitingRoom = signal(false);
  loading = signal(false);
  section = signal<Section>('main');
  spotlightId = signal<string | null>(null);

  // ── Poll form state ────────────────────────────────────────────────────────
  showPollForm = signal(false);
  isLaunchingPoll = signal(false);
  pollQuestion = '';
  pollOptions: string[] = ['', ''];
  pollMultiple = false;
  pollLetters = 'ABCDEF'.split('');

  readonly activePollCount = computed(() => this.ms.polls().filter(p => p.status === 'OPEN').length);

  // ── trackBy helpers ───────────────────────────────────────────────────────
  trackById(_i: number, item: Participant): string { return item.id; }
  trackPollId(_i: number, p: Poll): string { return p.id; }
  trackPollOptId(_i: number, o: any): string { return o.id; }
  trackPollOptIdx(i: number): number { return i; }

  handleClose() {
    if (this.section() !== 'main') {
      this.section.set('main');
    } else {
      this.closePanel.emit();
    }
  }

  // ── Host Settings (REST API + Optimistic Update) ───────────────────────────

  toggleLock() {
    const next = !this.isLocked();
    this.isLocked.set(next); // optimistic
    this.loading.set(true);
    this.hostControl.updateSetting(this.ms.meetingCode(), 'LOCK_MEETING', next).subscribe({
      next: () => {
        this.ms.showToast(next ? '🔒 Meeting locked' : '🔓 Meeting unlocked', 'info');
        this.loading.set(false);
      },
      error: () => {
        this.isLocked.set(!next); // rollback
        this.ms.showToast('Failed to update lock setting', 'error');
        this.loading.set(false);
      },
    });
  }

  toggleWaitingRoom() {
    const next = !this.waitingRoom();
    this.waitingRoom.set(next); // optimistic
    this.loading.set(true);
    this.hostControl.updateSetting(this.ms.meetingCode(), 'WAITING_ROOM', next).subscribe({
      next: () => {
        this.ms.showToast(next ? 'Waiting room enabled' : 'Waiting room disabled', 'info');
        this.loading.set(false);
      },
      error: () => {
        this.waitingRoom.set(!next); // rollback
        this.ms.showToast('Failed to update waiting room setting', 'error');
        this.loading.set(false);
      },
    });
  }

  toggleShare() {
    const next = !this.shareDisabled();
    this.shareDisabled.set(next); // optimistic
    this.loading.set(true);
    this.hostControl.updateSetting(this.ms.meetingCode(), 'DISABLE_SCREEN_SHARE', next).subscribe({
      next: () => {
        this.ms.showToast(next ? 'Screen sharing disabled' : 'Screen sharing enabled', 'info');
        this.loading.set(false);
      },
      error: () => {
        this.shareDisabled.set(!next); // rollback
        this.ms.showToast('Failed to update screen share setting', 'error');
        this.loading.set(false);
      },
    });
  }

  // ── Host Commands (REST API — one-shot, no toggle) ────────────────────────

  toggleMuteAll() {
    this.loading.set(true);
    this.hostControl.sendCommand(this.ms.meetingCode(), 'MUTE_ALL').subscribe({
      next: () => {
        this.allMuted.set(true);
        this.ms.showToast('🔇 All participants muted', 'info');
        this.loading.set(false);
      },
      error: () => {
        this.ms.showToast('Failed to mute all participants', 'error');
        this.loading.set(false);
      },
    });
  }

  removeParticipant(p: Participant) {
    this.loading.set(true);
    this.hostControl.sendCommand(this.ms.meetingCode(), 'KICK_PARTICIPANT', p.id).subscribe({
      next: () => {
        this.ms.showToast(`${p.name} has been removed from the meeting`, 'error');
        this.section.set('main');
        this.loading.set(false);
      },
      error: () => {
        this.ms.showToast(`Failed to remove ${p.name}`, 'error');
        this.loading.set(false);
      },
    });
  }

  // ── Spotlight (local only — no API) ───────────────────────────────────────

  setSpotlight(p: Participant) {
    this.spotlightId.set(p.id);
    this.ms.showToast(`✨ ${p.name} is now spotlighted`, 'success');
    this.section.set('main');
  }

  clearSpotlight() {
    this.spotlightId.set(null);
    this.ms.showToast('Spotlight removed', 'info');
    this.section.set('main');
  }

  endMeeting() { this.ms.endCall(); }

  // ── Poll helpers ──────────────────────────────────────────────────────────

  canLaunchPoll(): boolean {
    return this.pollQuestion.trim().length > 0 &&
      this.pollOptions.filter(o => o.trim().length > 0).length >= 2;
  }

  addPollOption(): void {
    if (this.pollOptions.length < 6) this.pollOptions = [...this.pollOptions, ''];
  }

  removePollOption(i: number): void {
    this.pollOptions = this.pollOptions.filter((_, idx) => idx !== i);
  }

  launchPoll(): void {
    if (!this.canLaunchPoll()) return;
    const options = this.pollOptions.filter(o => o.trim().length > 0);
    this.isLaunchingPoll.set(true);
    this.ms.createPoll({
      question: this.pollQuestion.trim(),
      options,
      isMultipleChoice: this.pollMultiple,
    }).subscribe({
      next: () => {
        // Chỉ reset form khi backend xác nhận thành công
        this.pollQuestion = '';
        this.pollOptions = ['', ''];
        this.pollMultiple = false;
        this.showPollForm.set(false);
        this.isLaunchingPoll.set(false);
      },
      error: () => {
        // Giữ nguyên form để user có thể sửa và thử lại
        this.isLaunchingPoll.set(false);
      },
    });
  }

  getPollPct(voteCount: number, poll: Poll): number {
    const total = this.getTotalVotes(poll);
    return total > 0 ? Math.round((voteCount / total) * 100) : 0;
  }

  getTotalVotes(poll: Poll): number {
    return poll.totalVotes || 0;
  }

  getSpotlightName(): string {
    return this.participants.find(p => p.id === this.spotlightId())?.name ?? 'Active';
  }

  otherParticipants() {
    return this.participants.filter(p => !p.isLocal);
  }

  nonHostParticipants() {
    return this.participants.filter(p => !p.isLocal && !p.isHost);
  }
}
