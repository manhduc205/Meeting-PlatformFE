import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SignalingService } from '../meeting-room/services/signaling.service';
import { MeetingService } from '../../core/services/meeting.service';
import { Subscription } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import { environment } from '../../../environments/environment';

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
  meetingService = inject(MeetingService);
  userSignal = this.authService.getUserSignal();

  get user() { return this.userSignal(); }

  /** Safe user initial — logic in TS avoids Angular strict-template warnings */
  get userInitial(): string {
    const name = this.user?.name;
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  private subs = new Subscription();
  private stompClient: Client | null = null;

  meetingId = signal('');
  meetingTitle = signal('Meeting');

  micOn = signal(true);
  camOn = signal(true);

  copied = signal(false);
  private copyTimeout: any;
  private localStream: MediaStream | null = null;

  microphones: MediaDeviceInfo[] = [];
  cameras: MediaDeviceInfo[] = [];

  selectedMicId: string = '';
  selectedCameraId: string = '';

  // ── Join flow state ────────────────────────────────────────────────────────
  joinStatus = signal<'IDLE' | 'JOINING' | 'WAITING' | 'APPROVED' | 'ERROR'>('IDLE');
  waitingMessage = signal('Host đã nhận được yêu cầu. Vui lòng đợi trong giây lát...');
  meetingPassword = '';
  showPasswordField = signal(false);
  /** Internal user ID returned by the backend join API — used to match WS approval messages */
  private myInternalUserId: string | null = null;

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      if (params['meetingId']) {
        this.meetingId.set(params['meetingId']);
      }
      if (params['title']) this.meetingTitle.set(params['title']);
    });

    await this.initDevices();
  }

  async initDevices() {
    try {
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
      console.error('Error accessing hardware devices:', err);
      this.micOn.set(false);
      this.camOn.set(false);
    }

    // Attach stream if videoElement is ready (may be called after change detection)
    setTimeout(() => {
      if (this.videoElement && this.localStream) {
        this.videoElement.nativeElement.srcObject = this.localStream;
      }
    }, 300);
  }

  ngOnDestroy() {
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    this.subs.unsubscribe();
    this._disconnectStomp();
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

  // ── Join Meeting Flow ──────────────────────────────────────────────────────

  joinMeeting() {
    const code = this.meetingId();
    if (!code) return;

    this.joinStatus.set('JOINING');

    this.meetingService.joinMeeting({
      meetingCode: code,
      meetingPassword: this.meetingPassword || undefined
    }).subscribe({
      next: (response) => {
        console.log('[WaitingRoom] joinMeeting response:', response);
        if (response.status === 'APPROVED') {
          this.joinStatus.set('APPROVED');
          this._navigateToRoom();
        } else if (response.status === 'WAITING') {
          // Store the backend internal userId for WS message matching
          this.myInternalUserId = response.userId ?? null;
          console.log('[WaitingRoom] Status=WAITING. My internalUserId:', this.myInternalUserId, '| Keycloak id:', this.user?.id);
          this.joinStatus.set('WAITING');
          if (response.message) {
            this.waitingMessage.set(response.message);
          }
          this._subscribeToWaitingRoomWS(code);
        } else if (response.status === 'REJECTED') {
          this.joinStatus.set('ERROR');
        }
      },
      error: (err) => {
        console.error('Join meeting error:', err);
        if (err.status === 401) {
          this.showPasswordField.set(true);
        }
        this.joinStatus.set('IDLE');
      }
    });
  }

  private _subscribeToWaitingRoomWS(code: string) {
    const authService = this.authService;
    authService.getToken().then(token => {
      this.stompClient = new Client({
        webSocketFactory: () => {
          const SockJS = (window as any).SockJS;
          if (SockJS) return new SockJS(`${environment.backendApiUrl}/ws/meeting?access_token=${token}`);
          return new WebSocket(`${environment.backendApiUrl.replace('http', 'ws')}/ws/meeting/websocket?access_token=${token}`);
        },
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 2000,
        onConnect: () => {
          console.log('[WaitingRoom] STOMP connected, subscribing to waiting-room topic for code:', code);
          this.stompClient!.subscribe(
            `/topic/meeting.${code}.waiting-room`,
            (msg: IMessage) => {
              try {
                const body = JSON.parse(msg.body);
                const incomingUserId: string | undefined = body.userId;
                console.log('[WaitingRoom] WS message received:', body,
                  '| my internalId:', this.myInternalUserId,
                  '| my keycloakId:', this.user?.id);

                // Support BOTH payload shapes:
                // NEW backend: { action: 'APPROVED'|'REJECTED', userId: '...' }
                // OLD backend: { type: 'PARTICIPANT_APPROVED'|'PARTICIPANT_REJECTED', userId: '...' }

                // isForMe: match against internalUserId first (most reliable),
                // then fall back to Keycloak id, then accept if no userId is set (broadcast).
                const isForMe =
                  !incomingUserId ||
                  (this.myInternalUserId != null && incomingUserId === this.myInternalUserId) ||
                  incomingUserId === this.user?.id;

                const isApproved =
                  body.action === 'APPROVED' ||
                  body.type === 'PARTICIPANT_APPROVED';

                const isRejected =
                  body.action === 'REJECTED' ||
                  body.type === 'PARTICIPANT_REJECTED';

                console.log('[WaitingRoom] isForMe:', isForMe, '| isApproved:', isApproved, '| isRejected:', isRejected);

                if (isForMe && isApproved) {
                  console.log('🔥 Đã được Host duyệt! Đang chuyển hướng vào phòng họp...');
                  this.joinStatus.set('APPROVED');
                  this._navigateToRoom();
                } else if (isForMe && isRejected) {
                  console.log('❌ Bị Host từ chối. Đang chuyển về trang chủ...');
                  this.joinStatus.set('ERROR');
                  this.waitingMessage.set('Bạn đã bị từ chối tham gia cuộc họp.');
                  setTimeout(() => this.router.navigate(['/']), 2500);
                }
              } catch (e) {
                console.warn('Failed to parse waiting-room WS payload', e);
              }
            }
          );
        },
        onStompError: (frame) => console.error('[WR-STOMP] error', frame),
      });
      this.stompClient.activate();
    });
  }

  private _disconnectStomp() {
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
    }
  }

  private _navigateToRoom() {
    // Stop local stream before entering the room (LiveKit will handle its own)
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    setTimeout(() => {
      this.router.navigate(['/meeting-room'], {
        queryParams: { meetingId: this.meetingId(), title: this.meetingTitle() }
      });
    }, 350);
  }

  copyLink() {
    const url = `${window.location.origin}/waiting-room?meetingId=${this.meetingId()}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      this.copyTimeout = setTimeout(() => this.copied.set(false), 2000);
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
