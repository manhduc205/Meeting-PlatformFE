import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MeetingStateService } from './services/meeting-state.service';
import { TopBarComponent } from './components/top-bar/top-bar.component';
import { VideoGridComponent } from './components/video-grid/video-grid.component';
import { ControlBarComponent } from './components/control-bar/control-bar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { AiPanelComponent } from './components/ai-panel/ai-panel.component';
import { WhiteboardComponent } from './components/whiteboard/whiteboard.component';
import { HostToolsPanelComponent } from './components/host-tools-panel/host-tools-panel.component';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TopBarComponent,
    VideoGridComponent,
    ControlBarComponent,
    SidebarComponent,
    AiPanelComponent,
    WhiteboardComponent,
    HostToolsPanelComponent,
  ],
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.scss']
})
export class VideoCallComponent implements OnInit, OnDestroy {
  ms = inject(MeetingStateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  async ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('meetingId') ?? '';
    const title = this.route.snapshot.queryParamMap.get('title') ?? 'Meeting';

    if (!code) {
      // No meeting code — redirect home
      this.router.navigate(['/']);
      return;
    }

    await this.ms.joinMeeting(code, title);
  }

  async ngOnDestroy() {
    // Only cleanup media if still connected (not if user manually left)
    if (!this.ms.hasLeft()) {
      await this.ms.cleanupMedia();
    }
  }

  navigateHome() {
    this.router.navigate(['/']);
  }
}
