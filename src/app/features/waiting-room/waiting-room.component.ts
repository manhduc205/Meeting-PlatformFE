import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { MeetingService, ActiveParticipantsResponse } from '../../core/services/meeting.service';

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss']
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  authService = inject(AuthService);
  userSignal = this.authService.getUserSignal();

  get user() {
    return this.userSignal();
  }

  meetingService = inject(MeetingService);

  meetingId = signal('');
  meetingTitle = signal('Loading...');
  meetingTime = signal('Loading schedules...');
  
  activeParticipantsInfo = signal<ActiveParticipantsResponse>({
    totalCount: 0,
    participants: [],
    displayText: 'No participants yet'
  });

  micOn = signal(true);
  camOn = signal(true);
  isJoining = signal(false);

  copied = signal(false);
  private copyTimeout: any;
  private localStream: MediaStream | null = null;

  microphones: MediaDeviceInfo[] = [];
  cameras: MediaDeviceInfo[] = [];

  selectedMicId: string = '';
  selectedCameraId: string = '';

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    // Read query params when coming from join meeting link/form
    this.route.queryParams.subscribe(params => {
      if (params['meetingId']) {
        this.meetingId.set(params['meetingId']);
        this.loadMeetingData(params['meetingId']);
      }
      if (params['title']) this.meetingTitle.set(params['title']);
    });

    await this.initDevices();
  }

  loadMeetingData(code: string) {
    this.meetingService.getMeetingInfo(code).subscribe({
      next: (info) => {
        if (info.title) this.meetingTitle.set(info.title);
        if (info.scheduledTime) this.meetingTime.set(info.scheduledTime);
      },
      error: (e) => console.error('Error fetching meeting info', e)
    });
    
    this.meetingService.getActiveParticipants(code).subscribe({
      next: (res) => this.activeParticipantsInfo.set(res),
      error: (e) => console.error('Error fetching participants', e)
    });
  }

  async initDevices() {
    try {
      // Prompt for permission first so devices can be enumerated with labels
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.localStream;
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.microphones = devices.filter(d => d.kind === 'audioinput');
      this.cameras = devices.filter(d => d.kind === 'videoinput');

      if (this.microphones.length > 0) this.selectedMicId = this.microphones[0].deviceId;
      if (this.cameras.length > 0) this.selectedCameraId = this.cameras[0].deviceId;

      this.updateTracksState();
    } catch (err) {
      console.error('Error accessing hardware devices: ', err);
      this.micOn.set(false);
      this.camOn.set(false);
    }
  }

  ngOnDestroy() {
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }

  toggleMic() { 
    this.micOn.update(v => !v); 
    this.updateTracksState();
  }
  
  toggleCam() { 
    this.camOn.update(v => !v); 
    this.updateTracksState();
  }

  updateTracksState() {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach(track => track.enabled = this.micOn());
    this.localStream.getVideoTracks().forEach(track => track.enabled = this.camOn());
  }

  async onDeviceChange() {
    if (this.localStream) {
       this.localStream.getTracks().forEach(t => t.stop());
    }
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: this.selectedMicId ? { exact: this.selectedMicId } : undefined },
        video: { deviceId: this.selectedCameraId ? { exact: this.selectedCameraId } : undefined }
      });
      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.localStream;
      }
      this.updateTracksState();
    } catch (e) {
      console.error('Error switching devices', e);
    }
  }

  joinNow() {
    this.isJoining.set(true);
    const code = this.meetingId();
    if (!code) {
      alert('Invalid Meeting ID');
      this.isJoining.set(false);
      return;
    }

    this.meetingService.joinMeeting({ meetingCode: code }).subscribe({
      next: (res) => {
        if (res.status === 'APPROVED') {
          this.router.navigate(['/meeting-room'], {
            queryParams: { meetingId: code }
          });
        } else if (res.status === 'WAITING') {
          alert('Host has been notified. Please wait for approval to join.');
          this.isJoining.set(false);
          // TODO: Intercept WebSocket KNOCK notification loop here
        } else {
          alert('Request to join was rejected.');
          this.isJoining.set(false);
        }
      },
      error: (e) => {
        console.error('Join error', e);
        alert('Could not join meeting. Please check password or try again later.');
        this.isJoining.set(false);
      }
    });
  }

  copyLink() {
    const url = `${window.location.origin}/waiting-room?meetingId=${this.meetingId()}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      this.copyTimeout = setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
