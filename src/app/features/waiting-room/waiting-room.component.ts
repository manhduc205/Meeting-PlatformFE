import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss']
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
  meetingId = signal('821-4942-019');
  meetingTitle = signal('Weekly Sync: Product & Design');
  meetingTime = signal('Today, 10:00 AM – 11:00 AM');
  participantCount = signal(12);

  micOn = signal(true);
  camOn = signal(true);
  isJoining = signal(false);

  copied = signal(false);
  private copyTimeout: any;

  microphones = [
    'Built-in Microphone (MacBook Pro)',
    'External USB Microphone',
    'Yeti Nano USB Mic',
  ];
  cameras = [
    'FaceTime HD Camera',
    'Logitech StreamCam',
    'OBS Virtual Camera',
  ];

  selectedMic = this.microphones[0];
  selectedCamera = this.cameras[0];

  participants = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCXbw3ZahtkQjyQC1uKV7uH_mO_N1Jvoiq66o4tjjNneKp1HO47Qu6HDDeupUAaTLJLipBNc7PMufolUa7PaSRa9xfrOQ_G9v9dYESH-ZXrokLoYyPd43XpgXdB-QyWnTJD6a8s3qqYCHKFjr-func8c5vzRnF0s6q_Lul9myYMlkjVqyJMl8FMVubYL_k0ssoZGZJUrzuCmBWe4q2G3OPZr8ul2UV4baSg9MCP92kcPdjkWPyO1jPTQ4pWY0fD2Le9OcfbbIZ05XM',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBWBjy9LRbtGYAaAJkp50ROhOO8YK9sJBDk0u9w_eV-wK-ZU62GZdG8gpRV2o8yu0A5jZC5-Bw3QD00381VOZEnQK626Hv9sVvsw2ArXm0aOLiEtCuVNEFu3i3KIUN10N1ZBMszoP6MFXYQFhGoUF_rgdlDX0nl7Wm9iuxpHqksCQUTUha1T_QkyrbHEcpAZ_S1z8taORNmd0141qic72al9CaCOauINbkEvvHBjkSvIUqdvqZK1eZgg04WJMVwtRO9chRFy2VzKjU',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAvxASoeCcvTfMPYCSnwFOlxZZmgKoFQDahV8Bp42PLEH_WaFyBNH-99Ms-kixmj3-FKb09Gk57UMZN5Qkr522WeuHYbcciXNsFGM4AIkj7ntDj31IuK7-yxyKv-hdvCXTaOSyzpdTcvSQxEYcHI3zSAhvrEbXnq_G2Ba_E5fYBftbT1mN8dJdXoBnwbvrGMKDMheHTHqDi60VmP-tJNqQJYLFt3NS8xaOuool9UG_2l2PgRkeaMg7qfTGl1i26Kf5kiS2LKi7IVo0',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBKEBwg6WRGi5iKC6iZOFm3bBN8ICUCqgw_re_bUbDXSeJdmhZKeUfUevYxrkviLmT2VUcz4rT6O4Isw9KJcJTWJ_UJW20BoxPmTo-dAPT6sbU_DmTK3PVOfzp9DlSIaGEzBFGw4z314UHIUYYNateIMm75336hAUNj9HMKcK7MRsBJBfj66qRl9Y6J6RUPyNJ9tVXrUlGIVmqTNtzlIvZFT7VWQvJMHrzq_Za2qYd3WaHJzJMna-E_7Bj850lEJyivthKG-kwUi9c',
  ];

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    // Read query params when coming from join meeting link/form
    this.route.queryParams.subscribe(params => {
      if (params['meetingId']) this.meetingId.set(params['meetingId']);
      if (params['title']) this.meetingTitle.set(params['title']);
    });
  }

  ngOnDestroy() {
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
  }

  toggleMic() { this.micOn.update(v => !v); }
  toggleCam() { this.camOn.update(v => !v); }

  joinNow() {
    this.isJoining.set(true);
    // Navigate to meeting room — extend routing as needed
    setTimeout(() => {
      this.router.navigate(['/meeting'], {
        queryParams: { meetingId: this.meetingId() }
      });
    }, 1200);
  }

  copyLink() {
    const url = `${window.location.origin}/waiting-room?meetingId=${this.meetingId()}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      this.copyTimeout = setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
