import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { MeetingService, MeetingCreateRequest, MeetingCreateResponse } from '../../../core/services/meeting.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-schedule-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule-modal.component.html',
  styleUrls: ['./schedule-modal.component.scss']
})
export class ScheduleModalComponent {
  @Output() close = new EventEmitter<void>();

  authService = inject(AuthService);
  meetingService = inject(MeetingService);
  router = inject(Router);

  user = this.authService.getUserSignal();

  // Form State
  title = signal('');
  useStartTime = signal(false);
  startDate = signal('');
  startTime = signal('09:00');
  
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
    this.startDate.set(today.toISOString().split('T')[0]);
    
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

    let startIso: string | undefined = undefined;
    if (this.useStartTime()) {
      startIso = `${this.startDate()}T${this.startTime()}:00`;
    }

    const payload: MeetingCreateRequest = {
      title: this.title(),
      meetingPassword: this.passcodeEnabled() ? this.passcode() : undefined,
      startTime: startIso,
      isWaitingRoomEnabled: this.waitingRoom()
    };

    this.meetingService.createMeeting(payload).subscribe({
      next: (res: MeetingCreateResponse) => {
         this.isSaving.set(false);
         this.close.emit();
         this.router.navigate(['/waiting-room'], { queryParams: { meetingId: res.meetingCode, title: res.title } });
      },
      error: (e: any) => {
         console.error(e);
         alert(e.error?.message || 'Failed to create meeting');
         this.isSaving.set(false);
      }
    });
  }
}
