import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SignalingService } from '../meeting-room/services/signaling.service';
import { Subscription } from 'rxjs';

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

  signalingService = inject(SignalingService);
  private subs = new Subscription();

  meetingId = signal('');
  meetingTitle = signal('Waiting Room');

  micOn = signal(true);
  camOn = signal(true);

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
        
        // Connect STOMP to listen for Host approval
        const currentUser = this.user;
        if (currentUser) {
          this.signalingService.connect(this.meetingId(), currentUser.id);
          this.subs.add(
            this.signalingService.actions$.subscribe(msg => {
              if (msg.type === 'APPROVED' || msg.type === 'ADMITTED') {
                if (!msg.targetId || msg.targetId === currentUser.id || msg.payload?.['userId'] === currentUser.id) {
                  this.router.navigate(['/meeting-room'], { queryParams: { meetingId: this.meetingId() }});
                }
              }
            })
          );
          // Also listen to presence just in case Event is there
          this.subs.add(
            this.signalingService.presence$.subscribe(msg => {
              if (msg.type === 'APPROVED' || msg.type === 'ADMITTED') {
                if (!msg.targetId || msg.targetId === currentUser.id || msg.payload?.['userId'] === currentUser.id) {
                  this.router.navigate(['/meeting-room'], { queryParams: { meetingId: this.meetingId() }});
                }
              }
            })
          );
        }
      }
      if (params['title']) this.meetingTitle.set(params['title']);
    });

    await this.initDevices();
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
    this.subs.unsubscribe();
    this.signalingService.disconnect();
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

  // User waits for WebSocket event instead of joining explicitly

  copyLink() {
    const url = `${window.location.origin}/waiting-room?meetingId=${this.meetingId()}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      this.copyTimeout = setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
