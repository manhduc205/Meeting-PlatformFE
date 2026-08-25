import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { InstantMeetingCreateRequest, MeetingService, MeetingCreateRequest, MeetingCreateResponse } from '../../../core/services/meeting.service';

@Component({
  selector: 'app-schedule-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule-modal.component.html',
  styleUrls: ['./schedule-modal.component.scss']
})
export class ScheduleModalComponent {
  @Input() mode: 'scheduled' | 'instant' = 'scheduled';
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<MeetingCreateResponse>();

  authService = inject(AuthService);
  meetingService = inject(MeetingService);
  user = this.authService.getUserSignal();

  // Form State
  title = signal('');
  startDate = signal('');
  startTime = signal('09:00');
  endDate = signal('');
  endTime = signal('10:00');
  inviteeInputs = signal<string[]>(['']);
  
  passcodeEnabled = signal(true);
  passcode = signal('');
  waitingRoom = signal(true);

  isSaving = signal(false);

  constructor() {
    this.initDefaults();
  }

  initDefaults() {
    // Title
    const name = this.user()?.name || 'User';
    this.title.set(`${name}'s Meeting Room`);

    // Date
    const today = new Date();
    this.startDate.set(this.formatDate(today));
    this.endDate.set(this.formatDate(today));
    
    // Passcode (6 random alphanumeric)
    this.passcode.set(this.generatePasscode());
  }

  generatePasscode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  saveMeeting() {
    this.isSaving.set(true);
    const commonPayload: InstantMeetingCreateRequest = {
      title: this.title(),
      meetingPassword: this.passcodeEnabled() ? this.passcode() : undefined,
      inviteeEmails: this.collectInviteeEmails(),
      isWaitingRoomEnabled: this.waitingRoom()
    };

    if (this.mode === 'instant') {
      this.meetingService.createInstantMeeting(commonPayload).subscribe({
        next: response => this.completeSave(response),
        error: error => this.handleSaveError(error)
      });
      return;
    }

    const start = new Date(`${this.startDate()}T${this.startTime()}:00`);
    const end = new Date(`${this.endDate()}T${this.endTime()}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() - start.getTime() < 15 * 60 * 1000) {
      alert('End time must be at least 15 minutes after start time.');
      this.isSaving.set(false);
      return;
    }

    const payload: MeetingCreateRequest = {
      ...commonPayload,
      plannedStartTime: start.toISOString(),
      plannedEndTime: end.toISOString()
    };

    this.meetingService.createMeeting(payload).subscribe({
      next: response => this.completeSave(response),
      error: error => this.handleSaveError(error)
    });
  }

  private completeSave(response: MeetingCreateResponse) {
    this.isSaving.set(false);
    this.saved.emit(response);
    this.close.emit();
  }

  private handleSaveError(error: any) {
    console.error(error);
    alert(error.error?.message || 'Failed to create meeting');
    this.isSaving.set(false);
  }

  addInviteeInput() {
    this.inviteeInputs.update(inputs => [...inputs, '']);
  }

  removeInviteeInput(index: number) {
    this.inviteeInputs.update(inputs => inputs.length === 1 ? [''] : inputs.filter((_, currentIndex) => currentIndex !== index));
  }

  updateInviteeInput(index: number, value: string) {
    this.inviteeInputs.update(inputs => inputs.map((input, currentIndex) => currentIndex === index ? value : input));
  }

  trackInviteeInput(index: number): number {
    return index;
  }

  private collectInviteeEmails(): string[] {
    return [...new Set(this.inviteeInputs()
      .flatMap(value => value.split(/[\s,;]+/))
      .map(email => email.trim().toLowerCase())
      .filter(Boolean))];
  }

  private formatDate(date: Date): string {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }
}
