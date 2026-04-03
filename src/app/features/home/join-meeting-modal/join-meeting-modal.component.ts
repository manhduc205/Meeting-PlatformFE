import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MeetingService } from '../../../core/services/meeting.service';

@Component({
  selector: 'app-join-meeting-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './join-meeting-modal.component.html',
  styleUrls: ['./join-meeting-modal.component.scss']
})
export class JoinMeetingModalComponent {
  @Output() close = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private meetingService = inject(MeetingService);
  private router = inject(Router);

  joinForm: FormGroup;
  showPassword = false;
  isJoining = false;
  errorMessage = '';

  constructor() {
    this.joinForm = this.fb.group({
      meetingCode: ['', [Validators.required, Validators.pattern(/^[0-9-]{10,}$/)]],
      password: ['', [Validators.required]]
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.joinForm.invalid) {
      this.joinForm.markAllAsTouched();
      return;
    }

    this.isJoining = true;
    this.errorMessage = '';
    
    // Clean code: remove hyphens
    const rawCode = this.joinForm.get('meetingCode')?.value || '';
    const cleanCode = rawCode.replace(/-/g, '');
    const password = this.joinForm.get('password')?.value || '';

    this.meetingService.joinMeeting({ meetingCode: cleanCode, meetingPassword: password }).subscribe({
      next: (res) => {
        this.isJoining = false;
        if (res.status === 'WAITING') {
          this.router.navigate(['/waiting-room'], { queryParams: { meetingId: cleanCode } });
        } else if (res.status === 'APPROVED') {
          this.router.navigate(['/meeting-room'], { queryParams: { meetingId: cleanCode } });
        } else {
          this.errorMessage = 'Mã phòng hoặc mật khẩu không chính xác.';
        }
        this.close.emit();
      },
      error: (err) => {
        this.isJoining = false;
        this.errorMessage = 'Sai mã phòng hoặc mật khẩu!';
        console.error('Join error:', err);
      }
    });
  }
}
