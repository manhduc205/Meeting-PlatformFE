import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingStateService } from '../../services/meeting-state.service';
import { Poll } from '../../models/meeting.model';

@Component({
  selector: 'app-poll-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="poll-panel">

      <!-- ── Header ── -->
      <div class="poll-header">
        <div class="poll-header-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span>Polls</span>
          <span class="poll-count-badge" *ngIf="ms.polls().length > 0">{{ ms.polls().length }}</span>
        </div>
        <button
          *ngIf="ms.isHost()"
          class="create-poll-btn"
          (click)="toggleCreateForm()"
          [class.active]="showCreateForm()"
          title="Create new poll"
        >
          <svg *ngIf="!showCreateForm()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <svg *ngIf="showCreateForm()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {{ showCreateForm() ? 'Cancel' : 'New Poll' }}
        </button>
      </div>

      <!-- ── Create Poll Form ── -->
      <div class="create-form-wrapper" *ngIf="showCreateForm()" [@slideIn]>
        <div class="create-form">
          <div class="form-group">
            <label class="form-label">Question</label>
            <textarea
              class="form-textarea"
              [(ngModel)]="newQuestion"
              placeholder="Ask your audience something..."
              rows="2"
              maxlength="300"
            ></textarea>
            <span class="char-count">{{ newQuestion.length }}/300</span>
          </div>

          <div class="form-group">
            <label class="form-label">Options</label>
            <div class="options-list">
              <div
                *ngFor="let opt of newOptions; let i = index; trackBy: trackByIdx"
                class="option-input-row"
              >
                <div class="option-bullet">{{ optionLetters[i] }}</div>
                <input
                  class="option-input"
                  [(ngModel)]="newOptions[i]"
                  [placeholder]="'Option ' + optionLetters[i]"
                  maxlength="100"
                />
                <button
                  class="remove-option-btn"
                  *ngIf="newOptions.length > 2"
                  (click)="removeOption(i)"
                  title="Remove option"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>
            </div>
            <button
              class="add-option-btn"
              *ngIf="newOptions.length < 6"
              (click)="addOption()"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add option
            </button>
          </div>

          <div class="form-toggle-row">
            <span class="form-label">Multiple choice</span>
            <button
              class="toggle-switch"
              [class.on]="isMultipleChoice"
              (click)="isMultipleChoice = !isMultipleChoice"
              role="switch"
              [attr.aria-checked]="isMultipleChoice"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <button
            class="launch-btn"
            [disabled]="!canSubmit() || isSubmitting()"
            (click)="submitPoll()"
          >
            <svg *ngIf="!isSubmitting()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
            </svg>
            {{ isSubmitting() ? 'Đang tạo...' : 'Launch Poll' }}
          </button>
        </div>
      </div>

      <!-- ── Polls List ── -->
      <div class="polls-scroll" *ngIf="!showCreateForm()">

        <!-- Empty state -->
        <div class="polls-empty" *ngIf="ms.polls().length === 0">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <p class="empty-title">No polls yet</p>
          <p class="empty-sub" *ngIf="ms.isHost()">Create a poll to engage your audience</p>
          <p class="empty-sub" *ngIf="!ms.isHost()">The host hasn't started a poll yet</p>
        </div>

        <!-- Poll cards -->
        <div *ngFor="let poll of ms.polls(); trackBy: trackByPollId" class="poll-card" [class.closed]="poll.status === 'CLOSED'">

          <!-- Poll status bar -->
          <div class="poll-status-bar" [class.open]="poll.status === 'OPEN'" [class.closed]="poll.status === 'CLOSED'">
            <span class="status-dot"></span>
            <span>{{ poll.status === 'OPEN' ? 'Active' : 'Closed' }}</span>
            <span *ngIf="poll.isMultipleChoice" class="multi-badge">Multiple choice</span>
            <button
              *ngIf="ms.isHost() && poll.status === 'OPEN'"
              class="close-poll-btn"
              (click)="closePoll(poll.id)"
              title="Close poll"
            >Close</button>
          </div>

          <!-- Question -->
          <p class="poll-question">{{ poll.question }}</p>

          <!-- Options -->
          <div class="poll-options">
            <button
              *ngFor="let opt of poll.options; trackBy: trackByOptId"
              class="poll-option-btn"
              [class.voted]="opt.votedByMe"
              [class.has-voted]="poll.hasVoted"
              [class.closed]="poll.status === 'CLOSED'"
              [disabled]="poll.status === 'CLOSED'"
              (click)="vote(poll, opt.id)"
            >
              <!-- Vote fill bar -->
              <div
                class="vote-bar"
                *ngIf="poll.hasVoted || poll.status === 'CLOSED'"
                [style.width]="getVotePct(opt.voteCount, poll) + '%'"
              ></div>

              <!-- Content -->
              <div class="option-row">
                <span class="option-check" *ngIf="opt.votedByMe">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
                <span class="option-dot" *ngIf="!opt.votedByMe"></span>
                <span class="opt-text">{{ opt.text }}</span>
                <span class="opt-pct" *ngIf="poll.hasVoted || poll.status === 'CLOSED'">
                  {{ getVotePct(opt.voteCount, poll) }}%
                  <span class="opt-count">({{ opt.voteCount }})</span>
                </span>
              </div>
            </button>
          </div>

          <!-- Footer -->
          <div class="poll-footer">
            <span class="total-votes">{{ getTotalVotes(poll) }} {{ getTotalVotes(poll) === 1 ? 'vote' : 'votes' }}</span>
            <span class="voted-label" *ngIf="poll.hasVoted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              You voted
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./poll-panel.component.scss']
})
export class PollPanelComponent {
  ms = inject(MeetingStateService);

  showCreateForm = signal(false);
  isSubmitting = signal(false);
  newQuestion = '';
  newOptions: string[] = ['', ''];
  isMultipleChoice = false;
  optionLetters = 'ABCDEF'.split('');

  canSubmit = computed(() =>
    this.newQuestion.trim().length > 0 &&
    this.newOptions.filter(o => o.trim().length > 0).length >= 2
  );

  toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
    if (!this.showCreateForm()) this.resetForm();
  }

  addOption(): void {
    if (this.newOptions.length < 6) this.newOptions = [...this.newOptions, ''];
  }

  removeOption(i: number): void {
    this.newOptions = this.newOptions.filter((_, idx) => idx !== i);
  }

  submitPoll(): void {
    if (!this.canSubmit()) return;
    const options = this.newOptions.filter(o => o.trim().length > 0);
    this.isSubmitting.set(true);
    this.ms.createPoll({
      question: this.newQuestion.trim(),
      options,
      isMultipleChoice: this.isMultipleChoice,
    }).subscribe({
      next: () => {
        this.resetForm();
        this.showCreateForm.set(false);
        this.isSubmitting.set(false);
      },
      error: () => {
        // Giữ nguyên form để user có thể sửa và thử lại
        this.isSubmitting.set(false);
      },
    });
  }

  vote(poll: Poll, optionId: string): void {
    if (poll.status === 'CLOSED') return;
    this.ms.vote(poll.id, optionId);
  }

  closePoll(pollId: string): void {
    this.ms.closePoll(pollId);
  }

  getVotePct(voteCount: number, poll: Poll): number {
    const total = this.getTotalVotes(poll);
    return total > 0 ? Math.round((voteCount / total) * 100) : 0;
  }

  getTotalVotes(poll: Poll): number {
    return poll.totalVotes || 0;
  }

  trackByPollId(_: number, p: Poll): string { return p.id; }
  trackByOptId(_: number, o: any): string { return o.id; }
  trackByIdx(i: number): number { return i; }

  private resetForm(): void {
    this.newQuestion = '';
    this.newOptions = ['', ''];
    this.isMultipleChoice = false;
  }
}
